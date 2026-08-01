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

const recorder = new AudioRecorderPlayer();

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

const VoiceNoteRecorder = ({ onSaved, onCancel, maxMs = 60000 }: { onSaved: (path: string, ms: number) => void; onCancel: () => void; maxMs?: number }) => {
  const [recording, setRecording] = useState(false);
  const [time, setTime] = useState('00:00');
  const durRef = useRef(0);
  const stoppingRef = useRef(false);
  const recordingRef = useRef(false);

  useEffect(() => () => {
    recorder.removeRecordBackListener();
    if (recordingRef.current) {
      try { recorder.stopRecorder(); } catch {}
    }
  }, []);

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
