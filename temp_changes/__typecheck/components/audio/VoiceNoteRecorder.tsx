/**
 * FILE: src/components/audio/VoiceNoteRecorder.tsx
 * ROLE: Full-screen record voice note flow: Android mic permission, m4a recording into DocumentDirectory, max-60s cap with auto-stop, and onSaved(path, ms) / onCancel() contracts.
 * DEPENDS ON: react-native PermissionsAndroid/Platform (Android-only RECORD_AUDIO runtime permission); react-native-audio-recorder-player (recording engine, enum constants guarded by require); react-native-fs (DocumentDirectoryPath for the m4a output); props onSaved(path, ms), onCancel(), maxMs=60000.
 * USED BY: src/screens/QuranViewScreen.tsx:664-668 — rendered as an absolute-fill overlay when recordingVerseKey is set (long-press "Record" bubble, line 645).
 */
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, PermissionsAndroid, Platform } from 'react-native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import RNFS from 'react-native-fs';

let AudioEncoderAndroidType: any, OutputFormatAndroidType: any, AudioSourceAndroidType: any;
try {
  const mod = require('react-native-audio-recorder-player');
  AudioEncoderAndroidType = mod.AudioEncoderAndroidType;
  OutputFormatAndroidType = mod.OutputFormatAndroidType;
  AudioSourceAndroidType = mod.AudioSourceAndroidType;
} catch {}

// Single module-level recorder singleton — shared across all recordings.
const recorder = new AudioRecorderPlayer();

// Builds the Android audio config (16kHz / 24kbps / mono, MPEG_4 output, HE_AAC encoder with AAC fallback).
// Enum constants are imported defensively because they can be undefined on some RN versions.
const buildAudioSets = (): any => {
  const sets: any = { AudioSamplingRateAndroid: 16000, AudioEncodingBitRateAndroid: 24000, AudioChannelsAndroid: 1 };
  try {
    if (AudioSourceAndroidType && AudioSourceAndroidType.MIC !== undefined) sets.AudioSourceAndroid = AudioSourceAndroidType.MIC;
    if (OutputFormatAndroidType && OutputFormatAndroidType.MPEG_4 !== undefined) sets.OutputFormatAndroid = OutputFormatAndroidType.MPEG_4;
    if (AudioEncoderAndroidType) {
      if (AudioEncoderAndroidType.HE_AAC !== undefined) sets.AudioEncoderAndroid = AudioEncoderAndroidType.HE_AAC;
      else if (AudioEncoderAndroidType.AAC !== undefined) sets.AudioEncoderAndroid = AudioEncoderAndroidType.AAC;
    }
  } catch {}
  return sets;
};

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * VoiceNoteRecorder — modal-like overlay (flex:1) with timer, Start / Stop&Save / Cancel controls.
 * WHAT: Records an m4a voice note into RNFS.DocumentDirectoryPath and reports the result to the parent.
 * FLOW: 1) Start -> Android RECORD_AUDIO permission -> recorder.startRecorder with buildAudioSets() ->
 *           record-back listener updates the timer and auto-stops at maxMs via stop(true);
 *       2) stop(auto) guards double-stop with stoppingRef, saves only when ms > 500 (too-short alert otherwise);
 *       3) cancel stops silently and calls onCancel(); 4) unmount cleanup removes the listener and force-stops.
 * PROPS: onSaved(path, ms) — called with the absolute m4a path + duration ms only for recordings >500ms;
 *        onCancel() — called by Cancel; maxMs — cap (default 60000).
 * CALLS: PermissionsAndroid.request(RECORD_AUDIO); recorder.startRecorder/stopRecorder/addRecordBackListener/removeRecordBackListener.
 * CALLED BY: QuranViewScreen.tsx:666 — mounted when recordingVerseKey is set (audio paused first by the caller).
 * AFFECTS: Filesystem (m4a in DocumentDirectory) and, via onSaved, studentData.notes -> `audio:<path>` line (QuranViewScreen.tsx:407) -> SQLite + sync queue.
 * NOTES:
 *   - iOS mic permission is NOT requested in code (only Android); if Info.plist lacks NSMicrophoneUsageDescription the app would crash on startRecorder.
 *   - m4a files are orphaned: cancel/unmount leaves them in DocumentDirectory forever (no cleanup/delete).
 *   - The `ms` duration is passed to onSaved but DISCARDED by the parent (`_ms`, QuranViewScreen.tsx:404).
 */
const VoiceNoteRecorder = ({ onSaved, onCancel, maxMs = 60000 }: { onSaved: (path: string, ms: number) => void; onCancel: () => void; maxMs?: number }) => {
  const [recording, setRecording] = useState(false);
  const [time, setTime] = useState('00:00');
  const durRef = useRef(0);
  const stoppingRef = useRef(false);
  const recordingRef = useRef(false);

  // Unmount cleanup: drop the record-back listener and force-stop a still-running recording (the file is left on disk).
  useEffect(() => () => {
    recorder.removeRecordBackListener();
    if (recordingRef.current) {
      try { recorder.stopRecorder(); } catch {}
    }
  }, []);

  // Android-only runtime mic permission; non-Android platforms always pass (iOS relies on Info.plist).
  const requestPermission = async () => {
    if (Platform.OS !== 'android') return true;
    try {
      const g = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
        title: 'Microphone',
        message: 'Needed to record voice notes.',
        buttonPositive: 'OK',
      });
      return g === PermissionsAndroid.RESULTS.GRANTED;
    } catch { return false; }
  };

  // stop(auto): save the note when a result exists and duration >500ms; otherwise alert (silently on auto-stop).
  const stop = async (auto = false) => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    try {
      const res = await recorder.stopRecorder();
      recorder.removeRecordBackListener();
      setRecording(false);
      recordingRef.current = false;
      const ms = durRef.current;
      if (res && ms > 500) onSaved(res, ms);
      else if (!auto) Alert.alert('Too short', 'Hold on a moment — the recording was too short.');
    } catch (e: any) {
      if (!auto) Alert.alert('Error', e?.message || 'Could not stop recording.');
      setRecording(false);
      recordingRef.current = false;
    } finally {
      stoppingRef.current = false;
    }
  };

  // start: gate on the mic permission, then record to `audio_note_<ts>.m4a` in DocumentDirectory.
  // The record-back listener tracks progress (timer capped at maxMs) and triggers the auto-stop at maxMs.
  const start = async () => {
    if (!(await requestPermission())) {
      Alert.alert('Permission denied', 'Microphone access is required for voice notes.');
      return;
    }
    try {
      const path = `${RNFS.DocumentDirectoryPath}/audio_note_${Date.now()}.m4a`;
      await recorder.startRecorder(path, buildAudioSets());
      durRef.current = 0;
      stoppingRef.current = false;
      setRecording(true);
      recordingRef.current = true;
      recorder.addRecordBackListener((e: any) => {
        const pos = Math.min(e.currentPosition, maxMs);
        durRef.current = pos;
        setTime(fmt(pos));
        if (e.currentPosition >= maxMs) stop(true);
      });
    } catch (e: any) {
      Alert.alert('Recording error', e?.message || 'Could not start recording.');
    }
  };

  // cancel: silently stop the recorder (if live), reset state, and notify the parent to clear recordingVerseKey.
  const cancel = async () => {
    if (recording) { try { await recorder.stopRecorder(); recorder.removeRecordBackListener(); } catch {} }
    recordingRef.current = false;
    onCancel();
  };

  const atMax = recording && durRef.current >= maxMs - 200;

  return (
    <View style={styles.overlay}>
      <View style={styles.content}>
        <Text style={styles.title}>Voice Note</Text>
        <View style={styles.timerRow}>
          <Text style={[styles.timer, atMax && { color: '#FF4444' }]}>{recording ? time : 'Tap to start'}</Text>
          {recording && <Text style={styles.recIndicator}>● REC</Text>}
        </View>
        <Text style={styles.cap}>{recording ? `Max ${fmt(maxMs)}` : `Notes are capped at ${fmt(maxMs)} to save space`}</Text>
      </View>
      <View style={styles.controls}>
        <TouchableOpacity style={styles.cancelBtn} onPress={cancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        {!recording ? (
          <TouchableOpacity style={styles.startBtn} onPress={start}>
            <Text style={styles.startText}>Start</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.stopBtn} onPress={() => stop(false)}>
            <Text style={styles.stopText}>Stop & Save</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(18,18,20,0.92)', alignItems: 'center', paddingBottom: 56 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  timer: { color: '#00d4aa', fontSize: 64, fontWeight: 'bold', letterSpacing: 1, fontVariant: ['tabular-nums'] as const },
  recIndicator: { color: '#FF4444', fontSize: 14, fontWeight: '700' },
  cap: { color: '#888', fontSize: 12 },
  controls: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(18,18,20,0.85)',
    borderRadius: 16,
    padding: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    elevation: 10,
  },
  cancelBtn: { minWidth: 64, minHeight: 56, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#333', borderRadius: 12 },
  cancelText: { color: '#fff', fontWeight: '700' },
  startBtn: { minWidth: 64, minHeight: 56, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FF4444', borderRadius: 12 },
  startText: { color: '#fff', fontWeight: '700' },
  stopBtn: { minWidth: 64, minHeight: 56, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#00d4aa', borderRadius: 12 },
  stopText: { color: '#000', fontWeight: '700' },
});

export default VoiceNoteRecorder;
