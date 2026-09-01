/**
 * FILE: src/components/common/AnimatedHeader.tsx
 * ROLE: The Quran reader's top bar — surah name + 5 labeled action buttons, and an animated hide/show.
 *       Full dynamic theme palette integration (Classic Royal Navy, Madinah Emerald, OLED Obsidian).
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing, LayoutChangeEvent, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import TutorialAnchor from '../../tutorial/TutorialAnchor';
import Svg, { Path, Circle } from 'react-native-svg';
import { getThemeColors } from '../../utils/theme';

const C_MISTAKES = '#FF3B30';
const C_NOTES = '#FF9F0A';
const C_BOOKMARKS = '#FFD700';
const C_SETTINGS = '#8A8A8A';

interface Props {
  visible: boolean; surahName: string; surahId: number; nightMode: boolean;
  onBack: () => void; onOpenList: () => void; onMistakes: () => void;
  onShare: () => void; onNotes: () => void; onBookmarks: () => void; onSettings: () => void;
}

const st = { fill: 'none' as const, strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const IconBack = ({ c }: { c: string }) => (
  <Svg width={28} height={28} viewBox="0 0 24 24" {...st} stroke={c}><Path d="M15 4.5L7.5 12l7.5 7.5" /></Svg>
);
const IconPen = ({ c }: any) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" {...st} stroke={c}><Path d="M14 4l3 3-9 9-3 1 1-3 8-8z" /></Svg>
);
const IconShare = ({ c }: any) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" {...st} stroke={c}><Path d="M12 14V4" /><Path d="M8 8l4-4 4 4" /><Path d="M5 11v9h14v-9" /></Svg>
);
const IconNote = ({ c }: any) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" {...st} stroke={c}><Path d="M6 3h12v18l-4-2-4 2-4-2-2 2V3z" /><Path d="M9 8h6M9 12h6" /></Svg>
);
const IconSettings = ({ c }: any) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" {...st} stroke={c}><Circle cx="12" cy="12" r="3.2" /><Path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" /></Svg>
);

export const BookmarkIcon = ({ c = '#FFD700', size = 16, filled = false }: { c?: string; size?: number; filled?: boolean }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? c : 'none'} stroke={c} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M7 3h10v18l-5-3.6V3z" />
  </Svg>
);

const AnimatedHeader: React.FC<Props> = (p) => {
  const statusBarPad = useSafeAreaInsets().top;
  const { width } = useWindowDimensions();
  const [measured, setMeasured] = useState(0);
  const measuredRef = useRef(0);
  const measuredKey = useRef('');
  const native = useRef(new Animated.Value(p.visible ? 1 : 0)).current;
  const layout = useRef(new Animated.Value(p.visible ? 1 : 0)).current;

  const colorTheme = useSelector((s: any) => s.settings?.colorTheme || 'classic');
  const themeColors = useMemo(() => getThemeColors(colorTheme, p.nightMode), [colorTheme, p.nightMode]);

  const contentKey = useMemo(() => `${p.surahName}`, [p.surahName]);

  const onContentLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h <= 0) return;
    const key = `${contentKey}|${width}`;
    if (measuredKey.current === key && h <= measuredRef.current) return;
    measuredKey.current = key;
    measuredRef.current = h;
    setMeasured(h);
  }, [contentKey, width]);

  useEffect(() => {
    native.stopAnimation();
    layout.stopAnimation();
    const to = p.visible ? 1 : 0;
    const duration = p.visible ? 70 : 60;
    Animated.parallel([
      Animated.timing(native, { toValue: to, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(layout, { toValue: to, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start();
  }, [p.visible, native, layout]);

  const translateY = useMemo(
    () => (measured > 0 ? native.interpolate({ inputRange: [0, 1], outputRange: [-measured, 0], extrapolate: 'clamp' }) : 0),
    [measured, native],
  );

  const heightStyle = useMemo(
    () => (measured > 0
      ? layout.interpolate({ inputRange: [0, 1], outputRange: [0, measured], extrapolate: 'clamp' })
      : (p.visible ? undefined : 0)),
    [measured, layout, p.visible],
  );

  const bg = themeColors.headerBg;
  const borderC = themeColors.headerBorder;
  const titleColor = themeColors.text;
  const subColor = themeColors.subText;
  const primaryAccent = themeColors.accent;

  const Btn = ({ icon, label, onPress, labelStyle }: { icon: React.ReactNode; label: string; onPress: () => void; labelStyle?: any }) => (
    <TouchableOpacity style={s.iconBtn} onPress={onPress} activeOpacity={0.5} hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}>
      {icon}
      <Text style={[s.iconLab, labelStyle, { color: subColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Animated.View
      style={[s.wrap, { backgroundColor: bg, borderBottomColor: borderC, height: heightStyle, opacity: native }]}
      pointerEvents={p.visible ? 'auto' : 'none'}
    >
      <Animated.View
        style={{ transform: [{ translateY }], paddingTop: statusBarPad }}
        onLayout={onContentLayout}
      >
        <View style={s.topRow}>
          <TouchableOpacity onPress={p.onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={s.backBtn}>
            <IconBack c={primaryAccent} />
          </TouchableOpacity>
          <TutorialAnchor id="hdr-list">
          <TouchableOpacity onPress={p.onOpenList} style={s.titleBlock} activeOpacity={0.7}>
            <Text style={[s.surahName, { color: titleColor }]} numberOfLines={1}>{p.surahName}</Text>
            <Text style={[s.surahSub, { color: subColor }]} numberOfLines={1}>
              {`Surah ${p.surahId} ☰`}
            </Text>
          </TouchableOpacity>
          </TutorialAnchor>
          <View style={s.iconsRow}>
            <TutorialAnchor id="hdr-share"><Btn label="SHARE" icon={<IconShare c={primaryAccent} />} onPress={p.onShare} /></TutorialAnchor>
            <TutorialAnchor id="hdr-mistakes"><Btn label="MISTAKES" icon={<IconPen c={C_MISTAKES} />} onPress={p.onMistakes} /></TutorialAnchor>
            <TutorialAnchor id="hdr-notes"><Btn label="NOTES" icon={<IconNote c={C_NOTES} />} onPress={p.onNotes} /></TutorialAnchor>
            <Btn label="BOOKMARKS" icon={<BookmarkIcon c={C_BOOKMARKS} size={20} />} onPress={p.onBookmarks} />
            <TutorialAnchor id="hdr-settings"><Btn label="SETTINGS" labelStyle={s.iconLabTight} icon={<IconSettings c={C_SETTINGS} />} onPress={p.onSettings} /></TutorialAnchor>
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
};

const s = StyleSheet.create({
  wrap: { borderBottomWidth: 1, zIndex: 100, overflow: 'hidden' },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingTop: 4, paddingBottom: 4 },
  backBtn: { minHeight: 42, minWidth: 44, alignItems: 'center', justifyContent: 'center', marginRight: 2 },
  titleBlock: { flex: 1, paddingVertical: 1 },
  surahName: { fontSize: 16, fontWeight: 'bold' },
  surahSub: { fontSize: 10, marginTop: 1 },
  iconsRow: { flex: 1.8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly' },
  iconBtn: { flex: 1, minWidth: 44, maxWidth: 60, minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  iconLab: { fontSize: 8, marginTop: 1 },
  iconLabTight: { fontSize: 7.5, marginHorizontal: 2 },
});

export default React.memo(AnimatedHeader);
