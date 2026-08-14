/**
 * FILE: src/components/audio/VoiceNoteRecorder.tsx
 * ROLE: Footer-bar voice note recorder (replaces the AudioPlayerBar footer while recording — NOT a
 *       full-screen overlay; the mushaf page stays fully interactive behind it). Flow: Start (mic
 *       permission) -> Pause/Resume/Stop -> auto-save on Stop -> "done" footer (bar + Delete on the
 *       right) auto-hides after 4s -> onCancel(). Auto-stops at maxMs (60s) and saves.
 * DEPENDS ON: react-native PermissionsAndroid/Platform; react-native-audio-recorder-player (singleton,
 *       enum constants guarded by require); react-native-fs (DocumentDirectoryPath + unlink cleanup).
 * PROPS: onSaved(path, ms) — called with the absolute m4a path + duration ms for recordings >500ms;
 *        onCancel() — called by Cancel (abort) or when the done-state footer auto-hides;
 *        onDelete() — called by the Delete button in the done state (note already saved; parent removes it);
 *        maxMs — cap (default 60000).
 * CALLS: PermissionsAndroid.request(RECORD_AUDIO); recorder.startRecorder/stopRecorder/pauseRecorder/
 *        resumeRecorder/addRecordBackListener/removeRecordBackListener; RNFS.unlink (best-effort cleanup
 *        of the partial m4a on Cancel / Delete, and of the too-short file).
 * CALLED BY: QuranViewScreen.tsx — mounted when recordingVerseKey is set (audio paused first by the caller),
 *        gated so the AudioPlayerBar footer is hidden while recordingVerseKey is set.
 * AFFECTS: Filesystem (m4a in DocumentDirectory) and, via onSaved, studentData.notes -> `audio:<path>`
 *        line -> SQLite + sync queue.
 * NOTES:
 *   - iOS mic permission is NOT requested in code (only Android).
 *   - The `ms` duration is passed to onSaved but DISCARDED by the parent (`_ms`, QuranViewScreen.tsx).
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

type Phase = 'idle' | 'recording' | 'paused' | 'done';

const VoiceNoteRecorder = ({ onSaved, onCancel, onDelete, maxMs = 60000 }: { onSaved: (path: string, ms: number) => void; onCancel: () => void; onDelete?: () => void; maxMs?: number }) => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [time, setTime] = useState('00:00');
  const durRef = useRef(0);
  const pathRef = useRef<string | null>(null);
  const stoppingRef = useRef(false);
  const liveRef = useRef(false); // recorder is actually running (not paused) — drives unmount force-stop

  // Unmount cleanup: drop the record-back listener and force-stop a still-running recording.
  useEffect(() => () => {
    recorder.removeRecordBackListener();
    if (liveRef.current) {
      try { recorder.stopRecorder(); } catch {}
    }
  }, []);

  // Done-state footer auto-hides after 4s and restores the normal player bar via onCancel().
  useEffect(() => {
    if (phase !== 'done') return;
    const t = setTimeout(() => onCancel(), 4000);
    return () => clearTimeout(t);
  }, [phase, onCancel]);

  const bestEffortUnlink = (p: string | null) => { if (p) { try { RNFS.unlink(p); } catch {} } };

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
      liveRef.current = false;
      const ms = durRef.current;
      if (res && ms > 500) {
        onSaved(res, ms);
        setPhase('done');
      } else {
        bestEffortUnlink(res || pathRef.current);
        if (!auto) Alert.alert('Too short', 'Hold on a moment — the recording was too short.');
        setPhase('idle');
        setTime('00:00');
        durRef.current = 0;
      }
    } catch (e: any) {
      if (!auto) Alert.alert('Error', e?.message || 'Could not stop recording.');
      liveRef.current = false;
      setPhase('idle');
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
      pathRef.current = path;
      durRef.current = 0;
      stoppingRef.current = false;
      liveRef.current = true;
      setPhase('recording');
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

  const pause = async () => {
    try {
      await recorder.pauseRecorder();
      liveRef.current = false;
      setPhase('paused');
    } catch (e: any) {
      Alert.alert('Pause error', e?.message || 'Could not pause recording.');
    }
  };

  const resume = async () => {
    try {
      await recorder.resumeRecorder();
      liveRef.current = true;
      setPhase('recording');
    } catch (e: any) {
      Alert.alert('Resume error', e?.message || 'Could not resume recording.');
    }
  };

  // cancel: silently stop the recorder (if live), delete the partial m4a, reset, and notify the parent.
  const cancel = async () => {
    if (liveRef.current || phase === 'recording' || phase === 'paused') {
      try { await recorder.stopRecorder(); recorder.removeRecordBackListener(); } catch {}
    }
    liveRef.current = false;
    bestEffortUnlink(pathRef.current);
    pathRef.current = null;
    durRef.current = 0;
    onCancel();
  };

  // delete (done state): remove the saved m4a from disk, then let the parent drop the note line.
  const deleteNote = () => {
    bestEffortUnlink(pathRef.current);
    pathRef.current = null;
    onDelete?.();
    onCancel();
  };

  const atMax = (phase === 'recording' || phase === 'paused') && durRef.current >= maxMs - 200;
  const pct = Math.min(100, (durRef.current / maxMs) * 100);
  const caption = phase === 'idle' ? 'Notes are capped at 01:00 to save space'
    : phase === 'recording' ? 'Recording — tap Stop when done'
    : phase === 'paused' ? 'Paused — tap Resume to continue'
    : 'Saved — Delete to remove the note';

  return (
    <View style={styles.container}>
      <Text style={styles.caption}>{caption}</Text>
      <View style={styles.controls}>
        {phase !== 'done' && (
          <TouchableOpacity style={styles.cancelBtn} onPress={cancel} activeOpacity={0.7}>
            <Text style={styles.cancelText}>✕</Text>
          </TouchableOpacity>
        )}
        {phase === 'idle' && (
          <TouchableOpacity style={[styles.mainBtn, styles.mainTeal]} onPress={start} activeOpacity={0.85}>
            <Text style={styles.mainGlyphDark}>▶</Text>
          </TouchableOpacity>
        )}
        {phase === 'recording' && (
          <TouchableOpacity style={[styles.mainBtn, styles.mainWhite]} onPress={pause} activeOpacity={0.85}>
            <Text style={styles.mainGlyphDark}>❚❚</Text>
          </TouchableOpacity>
        )}
        {phase === 'paused' && (
          <TouchableOpacity style={[styles.mainBtn, styles.mainTeal]} onPress={resume} activeOpacity={0.85}>
            <Text style={styles.mainGlyphDark}>▶</Text>
          </TouchableOpacity>
        )}
        {(phase === 'recording' || phase === 'paused') && (
          <TouchableOpacity style={[styles.mainBtn, styles.mainRed]} onPress={() => stop(false)} activeOpacity={0.85}>
            <Text style={styles.mainGlyphLight}>■</Text>
          </TouchableOpacity>
        )}
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${pct}%` }, atMax && { backgroundColor: '#FF4444' }]} />
        </View>
        <Text style={[styles.timer, atMax && { color: '#FF4444' }]}>{`${time} / ${fmt(maxMs)}`}</Text>
        {phase === 'done' && (
          <TouchableOpacity style={styles.deleteBtn} onPress={deleteNote} activeOpacity={0.7}>
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#16161d', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 14, paddingVertical: 10, elevation: 12, zIndex: 50,
  },
  caption: { color: '#9a9a9a', fontSize: 11, textAlign: 'center', marginBottom: 8 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cancelBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: '#e8e8e8', fontSize: 15, fontWeight: '700' },
  mainBtn: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', elevation: 3, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  mainTeal: { backgroundColor: '#1C3D72' },
  mainWhite: { backgroundColor: '#1A1A1A' },
  mainRed: { backgroundColor: '#FF5252' },
  mainGlyphDark: { color: '#F8F9FA', fontSize: 20, fontWeight: '700' },
  mainGlyphLight: { color: '#1A1A1A', fontSize: 22, fontWeight: '700' },
  barTrack: { flex: 1, height: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 6, backgroundColor: '#1C3D72' },
  timer: { color: '#e8e8e8', fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] as const, minWidth: 84, textAlign: 'right' },
  deleteBtn: { minWidth: 64, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,82,82,0.15)', borderWidth: 1, borderColor: 'rgba(255,82,82,0.6)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  deleteText: { color: '#FF6B6B', fontSize: 13, fontWeight: '700' },
});

export default VoiceNoteRecorder;
