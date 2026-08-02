import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing, LayoutChangeEvent } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

const ACCENT = '#00D4AA';
const C_MISTAKES = '#FF3B30';
const C_SHARE = '#00D4AA';
const C_NOTES = '#FF9F0A';
const C_SETTINGS = '#8A8A8A';

interface Props {
  visible: boolean; surahName: string; surahId: number; juz: number; page: number; pagesLeftInJuz: number; nightMode: boolean;
  onBack: () => void; onOpenList: () => void; onMistakes: () => void;
  onShare: () => void; onNotes: () => void; onSettings: () => void;
}

const st = { fill: 'none' as const, strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const IconBack = ({ c }: { c: string }) => (
  <Svg width={28} height={28} viewBox="0 0 24 24" {...st} stroke={c} strokeWidth={2.2}><Path d="M15 4.5L7.5 12l7.5 7.5" /></Svg>
);
const IconPen = ({ c }: any) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" {...st} stroke={c}><Path d="M14 4l3 3-9 9-3 1 1-3 8-8z" /></Svg>
);
const IconShare = ({ c }: any) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" {...st} stroke={c}><Path d="M12 14V4" /><Path d="M8 8l4-4 4 4" /><Path d="M5 11v9h14v-9" /></Svg>
);
const IconNote = ({ c }: any) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" {...st} stroke={c}><Path d="M6 3h12v18l-4-2-4 2-4-2-2 2V3z" /><Path d="M9 8h6M9 12h6" /></Svg>
);
const IconSettings = ({ c }: any) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" {...st} stroke={c}><Circle cx="12" cy="12" r="3.2" /><Path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" /></Svg>
);

export const BookmarkIcon = ({ c = '#FFD700', size = 16, filled = false }: { c?: string; size?: number; filled?: boolean }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? c : 'none'} stroke={c} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M7 3h10v18l-5-3.6L7 21V3z" />
  </Svg>
);

const AnimatedHeader: React.FC<Props> = (p) => {
  const [measured, setMeasured] = useState(0);
  const native = useRef(new Animated.Value(p.visible ? 1 : 0)).current;
  const layout = useRef(new Animated.Value(p.visible ? 1 : 0)).current;

  useEffect(() => {
    native.stopAnimation();
    layout.stopAnimation();
    Animated.parallel([
      Animated.timing(native, { toValue: p.visible ? 1 : 0, duration: p.visible ? 150 : 110, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(layout, { toValue: p.visible ? 1 : 0, duration: p.visible ? 150 : 110, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start();
  }, [p.visible, native, layout]);

  const translateY = useMemo(
    () => (measured > 0 ? native.interpolate({ inputRange: [0, 1], outputRange: [-measured, 0], extrapolate: 'clamp' }) : 0),
    [measured, native],
  );

  const heightStyle = measured > 0
    ? layout.interpolate({ inputRange: [0, 1], outputRange: [0, measured], extrapolate: 'clamp' })
    : (p.visible ? undefined : 0);

  const bg = p.nightMode ? '#1a1a2e' : '#f5f5f5';
  const titleColor = p.nightMode ? '#fff' : '#1a1a1a';
  const subColor = p.nightMode ? '#8a8a8a' : '#777';

  const btnTheme = {
    borderColor: p.nightMode ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.14)',
    backgroundColor: p.nightMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.045)',
  };
  const btnShadow = {
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  };

  const Btn = ({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) => (
    <TouchableOpacity style={[s.iconBtn, btnTheme, btnShadow]} onPress={onPress} activeOpacity={0.5} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
      {icon}
      <Text style={[s.iconLab, { color: subColor }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Animated.View
      style={[s.wrap, { backgroundColor: bg, borderBottomColor: '#2a2a2a', height: heightStyle, opacity: native }]}
      pointerEvents={p.visible ? 'auto' : 'none'}
    >
      <Animated.View
        style={{ transform: [{ translateY }] }}
        onLayout={(e: LayoutChangeEvent) => { const h = e.nativeEvent.layout.height; if (h > 0 && h !== measured) setMeasured(h); }}
      >
        <View style={s.topRow}>
          <TouchableOpacity onPress={p.onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={[s.backBtn, btnTheme, btnShadow]}>
            <IconBack c={ACCENT} />
          </TouchableOpacity>
          <TouchableOpacity onPress={p.onOpenList} style={s.titleBlock} activeOpacity={0.7}>
            <Text style={[s.surahName, { color: titleColor }]} numberOfLines={1}>{p.surahName}</Text>
            <Text style={[s.surahSub, { color: subColor }]} numberOfLines={1}>
              {`Surah ${p.surahId} ☰`}
            </Text>
          </TouchableOpacity>
          <View style={s.iconsRow}>
            <Btn label="MISTAKES" icon={<IconPen c={C_MISTAKES} />} onPress={p.onMistakes} />
            <Btn label="SHARE" icon={<IconShare c={C_SHARE} />} onPress={p.onShare} />
            <Btn label="NOTES" icon={<IconNote c={C_NOTES} />} onPress={p.onNotes} />
            <Btn label="SETTINGS" icon={<IconSettings c={C_SETTINGS} />} onPress={p.onSettings} />
          </View>
        </View>
        <Text style={[s.infoLine, { color: subColor }]}>
          Juz {p.juz}{p.page > 0 ? ` · Page ${p.page} · ${p.pagesLeftInJuz} left in Juz` : ''}
        </Text>
      </Animated.View>
    </Animated.View>
  );
};

const s = StyleSheet.create({
  wrap: { borderBottomWidth: 1, zIndex: 100, overflow: 'hidden' },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingTop: 6, paddingBottom: 6 },
  backBtn: { minHeight: 46, minWidth: 56, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: 2 },
  titleBlock: { flex: 1, paddingVertical: 2 },
  surahName: { fontSize: 17, fontWeight: 'bold' },
  surahSub: { fontSize: 11, marginTop: 2 },
  iconsRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly' },
  iconBtn: { flex: 1, minWidth: 0, maxWidth: 72, minHeight: 46, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  iconLab: { fontSize: 8.5, marginTop: 2, fontWeight: '600' },
  infoLine: { fontSize: 11, paddingHorizontal: 12, paddingBottom: 8, paddingTop: 2 },
});

export default React.memo(AnimatedHeader);
