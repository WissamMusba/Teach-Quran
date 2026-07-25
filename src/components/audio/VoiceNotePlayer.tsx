import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { COLORS, SPACING, RADIUS, scaleFont } from '../../utils/theme';
const player = new AudioRecorderPlayer();
interface Props { uri: string; label?: string; }
const VoiceNotePlayer: React.FC<Props> = ({ uri, label }) => {
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const progress = useSharedValue(0);
  useEffect(() => () => { player.stopPlayer().catch(() => {}); player.removePlayBackListener(); }, []);
  const toggle = async () => { try { if (playing) { await player.pausePlayer(); setPlaying(false); return; } await player.startPlayer(uri); setPlaying(true); player.addPlayBackListener(e => { setPos(e.currentPosition); setDur(e.duration); progress.value = e.duration > 0 ? e.currentPosition / e.duration : 0; if (e.currentPosition >= e.duration - 100) { player.stopPlayer(); setPlaying(false); progress.value = 0; } }); } catch {} };
  const bar = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  const fmt = (ms: number) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  return (
    <View style={styles.box}>
      <TouchableOpacity onPress={toggle} style={styles.play} activeOpacity={0.7}><Text style={styles.playIcon}>{playing ? '⏸' : '▶'}</Text></TouchableOpacity>
      <View style={styles.info}><Text style={styles.label}>{label || 'Voice Note'}</Text><View style={styles.track}><Animated.View style={[styles.fill, bar]} /></View><Text style={styles.time}>{fmt(pos)} / {fmt(dur)}</Text></View>
    </View>
  );
};
const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bgCardLight, borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.sm },
  play: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md },
  playIcon: { fontSize: 16, color: COLORS.bgDark }, info: { flex: 1 },
  label: { color: COLORS.textPrimary, fontSize: scaleFont(13), fontWeight: '600', marginBottom: 4 },
  track: { height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 2 },
  time: { color: COLORS.textMuted, fontSize: scaleFont(11), marginTop: 3 },
});
export default React.memo(VoiceNotePlayer);
