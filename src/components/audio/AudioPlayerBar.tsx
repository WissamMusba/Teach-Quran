import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { COLORS, SPACING, scaleFont, BOTTOM_BAR_HEIGHT, SHADOWS } from '../../utils/theme';
const AudioPlayerBar = ({ onOpenQari, onTogglePlay, isPlaying }: any) => {
  const { currentQari, currentSurah } = useSelector((s: any) => s.audio);
  const playScale = useAnimatedStyle(() => ({ transform: [{ scale: withSpring(isPlaying ? 1.05 : 1, { damping: 15 }) }] }));
  return (
    <View style={[styles.container, SHADOWS.md]}>
      <Animated.View style={[styles.playBtn, playScale]}><TouchableOpacity onPress={onTogglePlay} activeOpacity={0.7} style={styles.playBtnInner}><Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶'}</Text></TouchableOpacity></Animated.View>
      <View style={styles.qariInfo}><Text style={styles.qariName} numberOfLines={1}>{currentQari}</Text><Text style={styles.surahName}>Surah {currentSurah}</Text></View>
      <TouchableOpacity onPress={onOpenQari} style={styles.expandBtn} activeOpacity={0.6}><Text style={styles.expandIcon}>⌃</Text></TouchableOpacity>
    </View>
  );
};
const styles = StyleSheet.create({
  container: { height: BOTTOM_BAR_HEIGHT, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bgCard, borderTopWidth: 1, borderTopColor: COLORS.borderDark, paddingHorizontal: SPACING.xl },
  playBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  playBtnInner: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  playIcon: { color: COLORS.bgDark, fontSize: scaleFont(20), fontWeight: 'bold' },
  qariInfo: { flex: 1, marginLeft: SPACING.lg },
  qariName: { color: COLORS.textPrimary, fontSize: scaleFont(15), fontWeight: '700' },
  surahName: { color: COLORS.textSecondary, fontSize: scaleFont(12), marginTop: 2 },
  expandBtn: { padding: SPACING.md }, expandIcon: { color: COLORS.textSecondary, fontSize: scaleFont(20) },
});
export default memo(AudioPlayerBar);
