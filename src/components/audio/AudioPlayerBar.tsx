/**
 * FILE: src/components/audio/AudioPlayerBar.tsx
 * ROLE: Bottom playback bar with reciter info, animated dancing equalizer bars when playing, and compact controls.
 */
import React, { memo, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { useSelector } from 'react-redux';
import Svg, { Path } from 'react-native-svg';

const IconPlay = ({ c, s = 18 }: { c: string; s?: number }) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill={c}><Path d="M8 5v14l11-7z" /></Svg>
);
const IconPause = ({ c, s = 18 }: { c: string; s?: number }) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill={c}><Path d="M7 4h3.5v16H7zM13.5 4H17v16h-3.5z" /></Svg>
);
const IconPrevTrack = ({ c, s = 14 }: { c: string; s?: number }) => (
  <Svg width={s} height={s} viewBox="0 0 24 24"><Path fill={c} d="M5.5 4v16H8V4zM17.5 5.5l-9 5.5 9 5.5z" /></Svg>
);
const IconNextTrack = ({ c, s = 14 }: { c: string; s?: number }) => (
  <Svg width={s} height={s} viewBox="0 0 24 24"><Path fill={c} d="M16 4h2.5v16H16zM4.5 5.5l8.5 5.75-8.5 5.75z" /></Svg>
);

const AudioEqualizer = ({ active, color }: { active: boolean; color: string }) => {
  const bars = [
    useRef(new Animated.Value(4)).current,
    useRef(new Animated.Value(8)).current,
    useRef(new Animated.Value(12)).current,
    useRef(new Animated.Value(6)).current,
  ];

  useEffect(() => {
    let loops: Animated.CompositeAnimation[] = [];
    if (active) {
      bars.forEach((b, i) => {
        const loop = Animated.loop(
          Animated.sequence([
            Animated.timing(b, { toValue: 4 + ((i * 3 + 7) % 11), duration: 240 + i * 40, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
            Animated.timing(b, { toValue: 2, duration: 200 + i * 35, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
            Animated.timing(b, { toValue: 6 + ((i * 4 + 5) % 10), duration: 260 + i * 30, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
          ])
        );
        loops.push(loop);
        loop.start();
      });
    } else {
      bars.forEach((b) => b.setValue(3));
    }
    return () => loops.forEach((l) => l.stop());
  }, [active, bars]);

  return (
    <View style={eqStyles.wrap}>
      {bars.map((b, idx) => (
        <Animated.View key={idx} style={[eqStyles.bar, { height: b, backgroundColor: color }]} />
      ))}
    </View>
  );
};

const eqStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', height: 16, gap: 2.5, marginRight: 6 },
  bar: { width: 2.5, borderRadius: 1.5 },
});

const AudioPlayerBar = ({
  onOpenQari,
  onOpenLoopSettings,
  onResume,
  onPlayPageStart,
  onPlayNewSurah,
  canPlayNewSurah,
  onPrevVerse,
  onNextVerse,
  canStep,
  isPlaying,
  canResume,
  loopEnabled,
  nightMode,
  surahId,
}: any) => {
  const { currentQari } = useSelector((s: any) => s.audio);
  const theme = nightMode ? darkTheme : lightTheme;
  const disC = nightMode ? '#5a5a5a' : '#b0b0b0';
  const showPlay = !isPlaying && !canResume;
  const accentColor = nightMode ? '#7BA7DB' : '#1C3D72';

  return (
    <View style={[styles.container, theme.container]}>
      <View style={styles.qariRow}>
        <TouchableOpacity style={styles.qariInfo} onPress={onOpenQari} activeOpacity={0.7}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {isPlaying && <AudioEqualizer active={isPlaying} color={accentColor} />}
            <Text style={[styles.qariName, theme.qariName]} numberOfLines={1}>{currentQari}</Text>
          </View>
          <Text style={[styles.surahName, theme.surahName]}>Surah {surahId}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.changeBtn, theme.ctrl]} onPress={onOpenLoopSettings} activeOpacity={0.7}>
          <Text style={[styles.changeText, theme.ctrlText]}>LOOP SETTINGS</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.changeBtn, theme.ctrl]} onPress={onOpenQari} activeOpacity={0.7}>
          <Text style={[styles.changeText, theme.ctrlText]}>▾ CHANGE</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.ctrlRow}>
        <TouchableOpacity style={[styles.circle, theme.ctrl, !canStep && styles.disabled]} onPress={onPrevVerse} disabled={!canStep} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <IconPrevTrack c={String(canStep ? (nightMode ? '#e8e8e8' : '#121212') : disC)} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.playCircle, theme.resumeBtn]} onPress={showPlay ? onPlayPageStart : onResume} activeOpacity={0.85} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          {isPlaying ? <IconPause c="#121212" s={18} /> : <IconPlay c="#121212" s={18} />}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.circle, theme.ctrl, !canStep && styles.disabled]} onPress={onNextVerse} disabled={!canStep} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <IconNextTrack c={String(canStep ? (nightMode ? '#e8e8e8' : '#121212') : disC)} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.action, loopEnabled ? theme.ctrl : styles.disabled]} onPress={onPlayPageStart} disabled={!loopEnabled} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8 }}>
          <Text style={[styles.actionText, theme.ctrlText, !loopEnabled && { color: disC }]}>{loopEnabled && isPlaying ? 'LOOP END' : 'LOOP START'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.action, canPlayNewSurah ? theme.ctrl : styles.disabled]} onPress={onPlayNewSurah} disabled={!canPlayNewSurah} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8 }}>
          <Text style={[styles.actionText, theme.ctrlText, !canPlayNewSurah && { color: disC }]}>SURAH START</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { borderTopWidth: 1, paddingHorizontal: 12, paddingVertical: 4 },
  qariRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  qariInfo: { flex: 1 },
  qariName: { fontSize: 12, fontWeight: 'bold' },
  surahName: { fontSize: 10 },
  changeBtn: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  changeText: { fontSize: 9, fontWeight: '700' },
  ctrlRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  circle: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  playCircle: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  action: { flex: 1, minHeight: 24, borderRadius: 10, paddingHorizontal: 4, justifyContent: 'center', alignItems: 'center' },
  actionText: { fontSize: 9.5, fontWeight: '700' },
  disabled: { opacity: 0.45 },
});

const darkTheme = StyleSheet.create({
  container: { backgroundColor: '#141824', borderTopColor: '#283048' },
  qariName: { color: '#fff' },
  surahName: { color: '#b0b0b0' },
  ctrl: { backgroundColor: 'rgba(255,255,255,0.08)' },
  ctrlText: { color: '#e8e8e8' },
  caption: { color: '#9a9a9a' },
  resumeBtn: { backgroundColor: '#7BA7DB' },
});

const lightTheme = StyleSheet.create({
  container: { backgroundColor: '#F3EFE4', borderTopColor: '#E2DDD0' },
  qariName: { color: '#1a1a1a' },
  surahName: { color: '#777' },
  ctrl: { backgroundColor: 'rgba(0,0,0,0.06)' },
  ctrlText: { color: '#1a1a1a' },
  caption: { color: '#8a8a8a' },
  resumeBtn: { backgroundColor: '#1C3D72' },
});

export default memo(AudioPlayerBar);
