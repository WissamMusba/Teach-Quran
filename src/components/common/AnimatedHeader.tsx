import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing, LayoutChangeEvent } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

const OPEN_MS = 150;
const CLOSE_MS = 110;
const ACCENT = '#00D4AA';

interface Props {
  visible: boolean; surahName: string; surahId: number; juz: number; page: number; pagesLeftInJuz: number; nightMode: boolean;
  onBack: () => void; onOpenList: () => void; onBookmarks: () => void; onMistakes: () => void;
  onShare: () => void; onNotes: () => void; onSettings: () => void;
}

const st = { fill: 'none' as const, strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const IconBack = ({ c }: { c: string }) => (
  <Svg width={28} height={28} viewBox="0 0 24 24" {...st} stroke={c} strokeWidth={2.2}><Path d="M15 4.5L7.5 12l7.5 7.5" /></Svg>
);
const IconBookmark = ({ c }: any) => (
  <Svg width={15} height={15} viewBox="0 0 24 24" {...st} stroke={c}><Path d="M7 3h10v18l-5-3.6L7 21V3z" /></Svg>
);
const IconPen = ({ c }: any) => (
  <Svg width={15} height={15} viewBox="0 0 24 24" {...st} stroke={c}><Path d="M14 4l3 3-9 9-3 1 1-3 8-8z" /></Svg>
);
const IconShare = ({ c }: any) => (
  <Svg width={15} height={15} viewBox="0 0 24 24" {...st} stroke={c}><Path d="M12 14V4" /><Path d="M8 8l4-4 4 4" /><Path d="M5 11v9h14v-9" /></Svg>
);
const IconNote = ({ c }: any) => (
  <Svg width={15} height={15} viewBox="0 0 24 24" {...st} stroke={c}><Path d="M6 3h12v18l-4-2-4 2-4-2-2 2V3z" /><Path d="M9 8h6M9 12h6" /></Svg>
);
const IconSettings = ({ c }: any) => (
  <Svg width={15} height={15} viewBox="0 0 24 24" {...st} stroke={c}><Circle cx="12" cy="12" r="3.2" /><Path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" /></Svg>
);

const AnimatedHeader: React.FC<Props> = (p) => {
  const [measured, setMeasured] = useState(0);
  const [slotOpen, setSlotOpen] = useState(p.visible);
  const anim = useRef(new Animated.Value(p.visible ? 1 : 0)).current;

  useEffect(() => {
    anim.stopAnimation();
    if (p.visible) {
      setSlotOpen(true);
      anim.setValue(0);
      Animated.timing(anim, { toValue: 1, duration: OPEN_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } else {
      Animated.timing(anim, { toValue: 0, duration: CLOSE_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true })
        .start(({ finished }) => { if (finished) setSlotOpen(false); });
    }
  }, [p.visible, anim]);

  const translateY = useMemo(
    () => (measured > 0 ? anim.interpolate({ inputRange: [0, 1], outputRange: [-measured, 0], extrapolate: 'clamp' }) : 0),
    [measured, anim],
  );

  const bg = p.nightMode ? '#1a1a2e' : '#f7f7f7';
  const borderC = p.nightMode ? '#2a2a2a' : '#e5e5e5';
  const titleColor = p.nightMode ? '#fff' : '#1a1a1a';
  const subColor = p.nightMode ? '#8a8a8a' : '#777';
  const barBg = p.nightMode ? 'rgba(200,200,215,0.38)' : 'rgba(18,18,20,0.92)';
  const iconC = p.nightMode ? '#2A2A2A' : '#E8E8E8';
  const labC = p.nightMode ? '#4A4A4A' : '#B0B0B0';

  const Btn = ({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) => (
    <TouchableOpacity style={s.btn} onPress={onPress} activeOpacity={0.5}>
      {icon}
      <Text style={[s.lab, { color: labC }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Animated.View
      style={[s.wrap, { backgroundColor: bg, borderBottomColor: borderC, height: slotOpen ? undefined : 0, opacity: anim }]}
      pointerEvents={slotOpen ? 'auto' : 'none'}
    >
      <Animated.View
        style={{ transform: [{ translateY }] }}
        onLayout={(e: LayoutChangeEvent) => { const h = e.nativeEvent.layout.height; if (h > 0 && h !== measured) setMeasured(h); }}
      >
        <View style={s.topRow}>
          <TouchableOpacity onPress={p.onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={s.backBtn}>
            <IconBack c={ACCENT} />
          </TouchableOpacity>
          <TouchableOpacity onPress={p.onOpenList} style={s.titleBlock} activeOpacity={0.7}>
            <Text style={[s.surahName, { color: titleColor }]} numberOfLines={1}>{p.surahName}</Text>
            <Text style={[s.surahSub, { color: subColor }]} numberOfLines={1}>
              {`Surah ${p.surahId} · Juz ${p.juz}${p.page > 0 ? ` · Page ${p.page}` : ''}`}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={[s.bar, { backgroundColor: barBg }]}>
          <Btn label="BOOKMARKS" icon={<IconBookmark c={iconC} />} onPress={p.onBookmarks} />
          <Btn label="MISTAKES" icon={<IconPen c={iconC} />} onPress={p.onMistakes} />
          <Btn label="SHARE" icon={<IconShare c={iconC} />} onPress={p.onShare} />
          <Btn label="NOTES" icon={<IconNote c={iconC} />} onPress={p.onNotes} />
          <Btn label="SETTINGS" icon={<IconSettings c={iconC} />} onPress={p.onSettings} />
        </View>
      </Animated.View>
    </Animated.View>
  );
};

const s = StyleSheet.create({
  wrap: { borderBottomWidth: 1, zIndex: 100, overflow: 'hidden' },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingTop: 6, paddingBottom: 6 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginRight: 2 },
  titleBlock: { flex: 1, paddingVertical: 2 },
  surahName: { fontSize: 17, fontWeight: 'bold' },
  surahSub: { fontSize: 11, marginTop: 2 },
  bar: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', borderRadius: 12, marginHorizontal: 10, marginBottom: 8, paddingHorizontal: 6, paddingVertical: 5 },
  btn: { width: 46, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  lab: { fontSize: 7.5, marginTop: 3, fontWeight: '600', letterSpacing: 0.4 },
});

export default React.memo(AnimatedHeader);
