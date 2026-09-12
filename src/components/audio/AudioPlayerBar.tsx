/**
 * FILE: src/components/audio/AudioPlayerBar.tsx
 * ROLE: Bottom playback bar with small non-bold typography, reciter info, animated dancing equalizer bars, and dynamic theme support.
 */
import React, { memo, useRef, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import Svg, { Path } from 'react-native-svg';
import { getThemeColors } from '../../utils/theme';
import JuicyButton from '../common/JuicyButton';

const IconPlay = ({ c, s = 16 }: { c: string; s?: number }) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill={c}><Path d="M8 5v14l11-7z" /></Svg>
);
const IconPause = ({ c, s = 16 }: { c: string; s?: number }) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill={c}><Path d="M7 4h3.5v16H7zM13.5 4H17v16h-3.5z" /></Svg>
);
const IconPrevTrack = ({ c, s = 13 }: { c: string; s?: number }) => (
  <Svg width={s} height={s} viewBox="0 0 24 24"><Path fill={c} d="M5.5 4v16H8V4zM17.5 5.5l-9 5.5 9 5.5z" /></Svg>
);
const IconNextTrack = ({ c, s = 13 }: { c: string; s?: number }) => (
  <Svg width={s} height={s} viewBox="0 0 24 24"><Path fill={c} d="M16 4h2.5v16H16zM4.5 5.5l8.5 5.75-8.5 5.75z" /></Svg>
);

const AudioEqualizer = ({ active, color, isTablet }: { active: boolean; color: string; isTablet?: boolean }) => {
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
            Animated.timing(b, { toValue: (isTablet ? 6 : 4) + ((i * 3 + 7) % 11), duration: 240 + i * 40, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
            Animated.timing(b, { toValue: isTablet ? 3 : 2, duration: 200 + i * 35, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
            Animated.timing(b, { toValue: (isTablet ? 8 : 6) + ((i * 4 + 5) % 10), duration: 260 + i * 30, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
          ])
        );
        loops.push(loop);
        loop.start();
      });
    } else {
      bars.forEach((b) => b.setValue(isTablet ? 4 : 3));
    }
    return () => loops.forEach((l) => l.stop());
  }, [active, bars, isTablet]);

  return (
    <View style={[eqStyles.wrap, isTablet && { height: 18, gap: 3.5, marginRight: 8 }]}>
      {bars.map((b, idx) => (
        <Animated.View key={idx} style={[eqStyles.bar, isTablet && { width: 3.5, borderRadius: 2 }, { height: b, backgroundColor: color }]} />
      ))}
    </View>
  );
};

const eqStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', height: 14, gap: 2.5, marginRight: 6 },
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
  const insets = useSafeAreaInsets();
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const isTablet = Math.min(winWidth, winHeight) >= 600 || winWidth >= 600;

  const { currentQari } = useSelector((s: any) => s.audio);
  const colorTheme = useSelector((s: any) => s.settings?.colorTheme || 'classic');
  const themeColors = useMemo(() => getThemeColors(colorTheme, nightMode), [colorTheme, nightMode]);

  const disC = nightMode ? '#5a5a5a' : '#b0b0b0';
  const showPlay = !isPlaying && !canResume;
  const accentColor = themeColors.accent;

  const iconStepSize = isTablet ? 17 : 13;
  const iconPlaySize = isTablet ? 20 : 16;

  return (
    <View style={[
      styles.container,
      { backgroundColor: themeColors.headerBg, borderTopColor: themeColors.headerBorder, paddingBottom: Math.max(8, insets.bottom) },
      isTablet && { paddingHorizontal: 18, paddingVertical: 6 }
    ]}>
      <View style={[styles.qariRow, isTablet && { marginBottom: 4 }]}>
        <TouchableOpacity style={styles.qariInfo} onPress={onOpenQari} activeOpacity={0.7}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {isPlaying && <AudioEqualizer active={isPlaying} color={accentColor} isTablet={isTablet} />}
            <Text style={[styles.qariName, { color: themeColors.text }, isTablet && { fontSize: 13.5 }]} numberOfLines={1}>{currentQari}</Text>
          </View>
          <Text style={[styles.surahName, { color: themeColors.subText }, isTablet && { fontSize: 11.5, marginTop: 1 }]}>Surah {surahId}</Text>
        </TouchableOpacity>
        <JuicyButton
          style={[
            styles.changeBtn,
            { backgroundColor: nightMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' },
            isTablet && { paddingHorizontal: 12, paddingVertical: 4.5, borderRadius: 12, marginLeft: 8 }
          ]}
          onPress={onOpenLoopSettings}
          activeOpacity={0.7}
          scaleTo={0.92}
        >
          <Text style={[styles.changeText, { color: themeColors.subText }, isTablet && { fontSize: 11.5 }]}>Loop settings</Text>
        </JuicyButton>
        <JuicyButton
          style={[
            styles.changeBtn,
            { backgroundColor: nightMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' },
            isTablet && { paddingHorizontal: 12, paddingVertical: 4.5, borderRadius: 12, marginLeft: 8 }
          ]}
          onPress={onOpenQari}
          activeOpacity={0.7}
          scaleTo={0.92}
        >
          <Text style={[styles.changeText, { color: themeColors.accent }, isTablet && { fontSize: 11.5 }]}>▾ Reciter</Text>
        </JuicyButton>
      </View>
      <View style={[styles.ctrlRow, isTablet && { gap: 10 }]}>
        <JuicyButton
          style={[
            styles.circle,
            { backgroundColor: nightMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' },
            !canStep && styles.disabled,
            isTablet && { width: 34, height: 34, borderRadius: 17 }
          ]}
          onPress={onPrevVerse}
          disabled={!canStep}
          activeOpacity={0.7}
          scaleTo={0.86}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <IconPrevTrack s={iconStepSize} c={String(canStep ? (nightMode ? '#e8e8e8' : '#121212') : disC)} />
        </JuicyButton>
        <JuicyButton
          style={[
            styles.playCircle,
            { backgroundColor: themeColors.primary },
            isTablet && { width: 38, height: 38, borderRadius: 19 }
          ]}
          onPress={showPlay ? onPlayPageStart : onResume}
          activeOpacity={0.85}
          scaleTo={0.88}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {isPlaying ? <IconPause c="#FFFFFF" s={iconPlaySize} /> : <IconPlay c="#FFFFFF" s={iconPlaySize} />}
        </JuicyButton>
        <JuicyButton
          style={[
            styles.circle,
            { backgroundColor: nightMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' },
            !canStep && styles.disabled,
            isTablet && { width: 34, height: 34, borderRadius: 17 }
          ]}
          onPress={onNextVerse}
          disabled={!canStep}
          activeOpacity={0.7}
          scaleTo={0.86}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <IconNextTrack s={iconStepSize} c={String(canStep ? (nightMode ? '#e8e8e8' : '#121212') : disC)} />
        </JuicyButton>
        <JuicyButton
          style={[
            styles.action,
            { backgroundColor: nightMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' },
            loopEnabled ? null : styles.disabled,
            isTablet && { minHeight: 32, borderRadius: 10 }
          ]}
          onPress={onPlayPageStart}
          disabled={!loopEnabled}
          activeOpacity={0.7}
          scaleTo={0.92}
          hitSlop={{ top: 8, bottom: 8 }}
        >
          <Text style={[styles.actionText, { color: loopEnabled ? themeColors.text : disC }, isTablet && { fontSize: 11.5 }]}>
            {loopEnabled && isPlaying ? 'Loop end' : 'Loop start'}
          </Text>
        </JuicyButton>
        <JuicyButton
          style={[
            styles.action,
            { backgroundColor: nightMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' },
            canPlayNewSurah ? null : styles.disabled,
            isTablet && { minHeight: 32, borderRadius: 10 }
          ]}
          onPress={onPlayNewSurah}
          disabled={!canPlayNewSurah}
          activeOpacity={0.7}
          scaleTo={0.92}
          hitSlop={{ top: 8, bottom: 8 }}
        >
          <Text style={[styles.actionText, { color: canPlayNewSurah ? themeColors.text : disC }, isTablet && { fontSize: 11.5 }]}>
            Surah start
          </Text>
        </JuicyButton>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { borderTopWidth: 1, paddingHorizontal: 12, paddingVertical: 4 },
  qariRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  qariInfo: { flex: 1 },
  qariName: { fontSize: 11, fontWeight: '500' },
  surahName: { fontSize: 9.5, fontWeight: '400' },
  changeBtn: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2.5, marginLeft: 6 },
  changeText: { fontSize: 9, fontWeight: '500' },
  ctrlRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  circle: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  playCircle: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  action: { flex: 1, minHeight: 24, borderRadius: 8, paddingHorizontal: 4, justifyContent: 'center', alignItems: 'center' },
  actionText: { fontSize: 9.5, fontWeight: '500' },
  disabled: { opacity: 0.45 },
});

export default memo(AudioPlayerBar);
