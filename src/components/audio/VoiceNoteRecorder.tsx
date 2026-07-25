import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, PermissionsAndroid, Platform } from 'react-native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, Easing } from 'react-native-reanimated';
import { COLORS, SPACING, RADIUS, scaleFont, SHADOWS } from '../../utils/theme';
const recorder = new AudioRecorderPlayer();
interface Props { onSaved: (path: string, ms: number) => void; onCancel: () => void; }
const VoiceNoteRecorder: React.FC<Props> = ({ onSaved, onCancel }) => {
  const [recording, setRecording] = useState(false);
  const [time, setTime] = useState('00:00');
  const durRef = useRef(0);
  const pulse = useSharedValue(1);
  useEffect(() => { pulse.value = recording ? withRepeat(withSequence(withTiming(1.3, { duration: 600, easing: Easing.inOut(Easing.ease) }), withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) })), -1, false) : withTiming(1, { duration: 200 }); }, [recording]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const requestPermission = async () => { if (Platform.OS !== 'android') return true; try { const g = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, { title: 'Microphone', message: 'Needed for voice notes.', buttonPositive: 'OK' }); return g === PermissionsAndroid.RESULTS.GRANTED; } catch { return false; } };
  const start = async () => { if (!(await requestPermission())) { Alert.alert('Denied', 'Mic access required.'); return; } try { const path = `audio_note_${Date.now()}.m4a`; await recorder.startRecorder(path); durRef.current = 0; setRecording(true); recorder.addRecordBackListener(e => { durRef.current = e.currentPosition; const s = Math.floor(e.currentPosition / 1000); setTime(`${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`); }); } catch (e: any) { Alert.alert('Error', e.message || 'Record failed'); } };
  const stop = async () => { try { const res = await recorder.stopRecorder(); recorder.removeRecordBackListener(); setRecording(false); if (res && durRef.current > 500) onSaved(res, durRef.current); else Alert.alert('Too Short', 'Try again.'); } catch (e: any) { Alert.alert('Error', e.message || 'Stop failed'); setRecording(false); } };
  const cancel = async () => { if (recording) { try { await recorder.stopRecorder(); recorder.removeRecordBackListener(); } catch {} } onCancel(); };
  return (
    <View style={[styles.box, SHADOWS.lg]}>
      <View style={styles.indicator}>{recording ? (<><Animated.View style={[styles.dot, pulseStyle]} /><Text style={styles.timer}>{time}</Text></>) : <Text style={styles.hint}>Tap to record a voice note</Text>}</View>
      <View style={styles.controls}>
        <TouchableOpacity style={styles.cancelBtn} onPress={cancel} activeOpacity={0.7}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
        {!recording ? <TouchableOpacity style={styles.recBtn} onPress={start} activeOpacity={0.7}><Text style={styles.recIcon}>🎤</Text><Text style={styles.recText}>Record</Text></TouchableOpacity> : <TouchableOpacity style={styles.stopBtn} onPress={stop} activeOpacity={0.7}><Text style={styles.recIcon}>⏹️</Text><Text style={styles.stopText}>Stop & Save</Text></TouchableOpacity>}
      </View>
    </View>
  );
};
const styles = StyleSheet.create({
  box: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, padding: SPACING.xl },
  indicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.xl, minHeight: 40 },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.red, marginRight: SPACING.sm },
  timer: { color: COLORS.textPrimary, fontSize: scaleFont(28), fontWeight: '700', fontVariant: ['tabular-nums'] },
  hint: { color: COLORS.textSecondary, fontSize: scaleFont(15) },
  controls: { flexDirection: 'row', justifyContent: 'center', gap: SPACING.lg },
  cancelBtn: { paddingVertical: SPACING.md, paddingHorizontal: SPACING.xl, borderRadius: RADIUS.md, backgroundColor: 'rgba(255,255,255,0.1)' },
  cancelText: { color: COLORS.textSecondary, fontSize: scaleFont(15), fontWeight: '600' },
  recBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.md, paddingHorizontal: SPACING.xxl, borderRadius: RADIUS.md, backgroundColor: COLORS.red, gap: SPACING.sm },
  recIcon: { fontSize: scaleFont(18) }, recText: { color: '#fff', fontSize: scaleFont(15), fontWeight: '700' },
  stopBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.md, paddingHorizontal: SPACING.xxl, borderRadius: RADIUS.md, backgroundColor: COLORS.primary, gap: SPACING.sm },
  stopText: { color: COLORS.bgDark, fontSize: scaleFont(15), fontWeight: '700' },
});
export default React.memo(VoiceNoteRecorder);
