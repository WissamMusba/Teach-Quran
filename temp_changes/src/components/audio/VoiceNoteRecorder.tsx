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
      <View style={styles.box}>
        <Text style={styles.title}>Voice Note</Text>
        <Text style={[styles.timer, atMax && { color: '#FF4444' }]}>{recording ? time : 'Tap record to start'}</Text>
        <Text style={styles.cap}>{recording ? `Max ${fmt(maxMs)}` : `Notes are capped at ${fmt(maxMs)} to save space`}</Text>
        <View style={styles.row}>
          <TouchableOpacity style={styles.cancelBtn} onPress={cancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          {!recording ? (
            <TouchableOpacity style={styles.recBtn} onPress={start}>
              <Text style={styles.recText}>Record</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.stopBtn} onPress={() => stop(false)}>
              <Text style={styles.stopText}>Stop & Save</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)' },
  box: { width: '82%', backgroundColor: '#1e1e1e', borderRadius: 14, padding: 24, alignItems: 'center' },
  title: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  timer: { color: '#00d4aa', fontSize: 34, fontWeight: 'bold', marginBottom: 6, fontVariant: ['tabular-nums'] as const },
  cap: { color: '#888', fontSize: 12, marginBottom: 18 },
  row: { flexDirection: 'row', width: '100%', gap: 10 },
  cancelBtn: { flex: 1, padding: 14, alignItems: 'center', backgroundColor: '#333', borderRadius: 10 },
  cancelText: { color: '#fff', fontWeight: '600' },
  recBtn: { flex: 1.4, padding: 14, alignItems: 'center', backgroundColor: '#FF4444', borderRadius: 10 },
  recText: { color: '#fff', fontWeight: '700' },
  stopBtn: { flex: 1.4, padding: 14, alignItems: 'center', backgroundColor: '#00d4aa', borderRadius: 10 },
  stopText: { color: '#000', fontWeight: '700' },
});

export default VoiceNoteRecorder;
