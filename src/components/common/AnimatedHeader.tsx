/**
 * FILE: src/components/common/AnimatedHeader.tsx
 * ROLE: The Quran reader's top bar — surah name/info line, 5 labeled action buttons (MISTAKES/SHARE/NOTES/BOOKMARKS/SETTINGS), and an animated hide/show (slide-up + height collapse). The bottom info line ("Juz N · Page N · X left in Juz") can be suppressed via showInfo (the "Show page info" settings toggle).
 * DEPENDS ON: nothing external — pure presentational; all data and callbacks arrive via props. react-native Animated/Easing; react-native-svg for inline vector icons (no icon lib); LayoutChangeEvent measures own content height for the collapse animation.
 * USED BY: src/screens/QuranViewScreen.tsx:19 (import), :508 (render)
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing, LayoutChangeEvent } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

// Per-button accent colors; MISTAKES is #FF3B30 — same as MISTAKE_COLOR in constants.ts.
const ACCENT = '#00D4AA';
const C_MISTAKES = '#FF3B30';
const C_SHARE = '#00D4AA';
const C_NOTES = '#FF9F0A';
const C_BOOKMARKS = '#FFD700';
const C_SETTINGS = '#8A8A8A';

/**
 * PROPS — all data/callbacks supplied by QuranViewScreen.tsx:508:
 *   visible: 1 = show / 0 = hide — drives the parallel slide-up + height-collapse animation.
 *   surahName: current surah display name (header title).
 *   surahId / juz / page / pagesLeftInJuz: info-line values; the "· Page N · X left in Juz" suffix is hidden when page <= 0 (ayah/continuous mode passes page=0).
 *   showInfo: optional (default true) — when false the whole bottom info line is NOT rendered (wired to the "Show page info" settings toggle); the top row always renders.
 *   onOpenJuz / onOpenPage: optional — when provided the "Juz N" / "Page N" info-line texts become tappable
 *   tablets that open the SurahList picker in juz/page priority mode (QuranViewScreen wires them to
 *   setSearchMode('juz'|'page') + setShowList(true)).
 *   nightMode: theme switch — background (#1a1a2e / #f5f5f5), title and subtitle colors.
 *   onBack → navigation.navigate('Dashboard'); onOpenList → setShowList(true) (in-screen surah list);
 *   onMistakes → 'Mistakes'; onShare → handleSharePage (screenshot via viewShot + Share.open); onNotes → 'Notes';
 *   onBookmarks → 'Bookmarks'; onSettings → 'Settings'.
 *   NOTE: the SPREAD toggle is NOT in the header anymore — it lives in MushafPageView's bottom-left actionPills (tablet only).
 */
interface Props {
  visible: boolean; surahName: string; surahId: number; juz: number; page: number; pagesLeftInJuz: number; nightMode: boolean; showInfo?: boolean;
  onBack: () => void; onOpenList: () => void; onMistakes: () => void;
  onShare: () => void; onNotes: () => void; onBookmarks: () => void; onSettings: () => void;
  onOpenJuz?: () => void; onOpenPage?: () => void;
}

// Inline SVG icons (no icon lib) — shared stroke config `st`; back arrow is 28px, the rest 20px.
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

/**
 * BookmarkIcon — exported standalone bookmark SVG icon (outline or filled), default #FFD700 / 16px.
 * Used by: the header BOOKMARKS button (size 20, line 99); QuranViewScreen.tsx:601 → `filled={pageLastBookmarked}` (24px)
 * marks the last verse of the current page in the spread/mushaf toolbar.
 */
export const BookmarkIcon = ({ c = '#FFD700', size = 16, filled = false }: { c?: string; size?: number; filled?: boolean }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? c : 'none'} stroke={c} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M7 3h10v18l-5-3.6L7 21V3z" />
  </Svg>
);

/**
 * AnimatedHeader — presentational header that collapses to zero height when `visible` is false, using two parallel Animated.Values.
 * FLOW: 1) `measured` state is set from the inner view's onLayout (the content's real height).
 *       2) Two Animated.Values created once: `native` (drives opacity + translateY) and `layout` (drives the container height).
 *       3) On `visible` change both animate in parallel: 150ms show / 110ms hide, Easing.out(cubic).
 *       4) translateY interpolates -measured → 0, so the content slides up out of the (overflow:hidden) wrapper.
 *       5) heightStyle interpolates 0 → measured; before first layout it falls back to undefined (visible) or 0 (hidden).
 *       6) pointerEvents = 'auto'/'none' so a hidden header never intercepts taps.
 * CALLED BY: QuranViewScreen.tsx:508 → rendered with headerInfo + isHeaderVisible + nightMode.
 * AFFECTS: Layout/render only — the `layout` height change pushes/pulls the reader content (mushaf font size is
 *          separately boosted when hidden, see responsive.ts).
 * NOTES/GOTCHA: the value named `native` uses useNativeDriver: false — it is a LAYOUT-driven animation (translateY/height
 *          are non-native props); the name is misleading, there is NO native-driver animation here.
 */
const AnimatedHeader: React.FC<Props> = (p) => {
  const [measured, setMeasured] = useState(0);
  const native = useRef(new Animated.Value(p.visible ? 1 : 0)).current;
  const layout = useRef(new Animated.Value(p.visible ? 1 : 0)).current;

  // Hide/show: run both values in parallel — slide/fade on `native`, height collapse on `layout`.
  useEffect(() => {
    native.stopAnimation();
    layout.stopAnimation();
    Animated.parallel([
      Animated.timing(native, { toValue: p.visible ? 1 : 0, duration: p.visible ? 150 : 110, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(layout, { toValue: p.visible ? 1 : 0, duration: p.visible ? 150 : 110, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start();
  }, [p.visible, native, layout]);

  // Animated styles derived from the measured height: slide-up translateY and 0↔measured height collapse.
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

  // Per-action button: icon above label, hitSlop padded; wired to the matching prop callback below.
  const Btn = ({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) => (
    <TouchableOpacity style={s.iconBtn} onPress={onPress} activeOpacity={0.5} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
      {icon}
      <Text style={[s.iconLab, { color: subColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{label}</Text>
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
          <TouchableOpacity onPress={p.onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={s.backBtn}>
            <IconBack c={ACCENT} />
          </TouchableOpacity>
          <TouchableOpacity onPress={p.onOpenList} style={s.titleBlock} activeOpacity={0.7}>
            <Text style={[s.surahName, { color: titleColor }]} numberOfLines={1}>{p.surahName}</Text>
            <Text style={[s.surahSub, { color: subColor }]} numberOfLines={1}>
              {`Surah ${p.surahId} ☰`}
            </Text>
          </TouchableOpacity>
          <View style={s.iconsRow}>
            <Btn label="SHARE" icon={<IconShare c={C_SHARE} />} onPress={p.onShare} />
            <Btn label="MISTAKES" icon={<IconPen c={C_MISTAKES} />} onPress={p.onMistakes} />
            <Btn label="NOTES" icon={<IconNote c={C_NOTES} />} onPress={p.onNotes} />
            <Btn label="BOOKMARKS" icon={<BookmarkIcon c={C_BOOKMARKS} size={20} />} onPress={p.onBookmarks} />
            <Btn label="SETTINGS" icon={<IconSettings c={C_SETTINGS} />} onPress={p.onSettings} />
          </View>
        </View>
        {p.showInfo !== false && (
          <View style={s.infoRow}>
            <TouchableOpacity onPress={p.onOpenJuz} disabled={!p.onOpenJuz} activeOpacity={0.5} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Text style={[s.infoLine, { color: subColor }]}>Juz {p.juz}</Text>
            </TouchableOpacity>
            {p.page > 0 && (
              <>
                <Text style={[s.infoLine, { color: subColor }]}> · </Text>
                <TouchableOpacity onPress={p.onOpenPage} disabled={!p.onOpenPage} activeOpacity={0.5} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Text style={[s.infoLine, { color: subColor }]}>Page {p.page}</Text>
                </TouchableOpacity>
                <Text style={[s.infoLine, { color: subColor }]}> · {p.pagesLeftInJuz} left in Juz</Text>
              </>
            )}
          </View>
        )}
      </Animated.View>
    </Animated.View>
  );
};

const s = StyleSheet.create({
  wrap: { borderBottomWidth: 1, zIndex: 100, overflow: 'hidden' },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingTop: 6, paddingBottom: 6 },
  backBtn: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', marginRight: 2 },
  titleBlock: { flex: 1, paddingVertical: 2 },
  surahName: { fontSize: 17, fontWeight: 'bold' },
  surahSub: { fontSize: 11, marginTop: 2 },
  iconsRow: { flex: 1.8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly' },
  iconBtn: { flex: 1, minWidth: 0, maxWidth: 60, minHeight: 46, alignItems: 'center', justifyContent: 'center' },
  iconLab: { fontSize: 8.5, marginTop: 2, fontWeight: '600' },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8, paddingTop: 2 },
  infoLine: { fontSize: 11 },
});

export default React.memo(AnimatedHeader);
