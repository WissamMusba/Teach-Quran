/**
 * FILE: src/components/common/AnimatedHeader.tsx
 * ROLE: The Quran reader's top bar — surah name + 5 labeled action buttons (MISTAKES/SHARE/NOTES/BOOKMARKS/SETTINGS), and an animated hide/show (slide-up + height collapse). The former "Juz N · Page N · X left in Juz" info line was removed (v87) to slim the header; page/juz info now lives in the bottom chrome strip.
 * DEPENDS ON: nothing external — pure presentational; all data and callbacks arrive via props. react-native Animated/Easing + useWindowDimensions; react-native-svg for inline vector icons (no icon lib); LayoutChangeEvent measures own content height for the collapse animation.
 *
 * PERFORMANCE (2026-08-08):
 *  - Show/hide is a SINGLE Animated.parallel over two values: `native` (opacity + translateY)
 *    and `layout` (container height collapse). Durations are 70ms show / 60ms hide with a gentle
 *    easing.out — instant-feel while staying visible. BOTH values stay JS-driven
 *    (useNativeDriver: false): the same Animated.View carries the height interpolation, and RN's
 *    native-driver validation rejects any component with a non-supported prop (height) when a
 *    native-driven value is attached — "Style property height is not supported by native module".
 *  - The content height is measured ONCE per (content | window-width) pair via a cached ref
 *    (`measuredKey` + `measuredRef`). The onLayout handler ignores every per-frame re-measure:
 *    the collapse/expand animation emits shrinking/growing heights under the SAME cache key,
 *    which are skipped, so the collapse interpolates against the CACHED value and the content
 *    never jumps. Re-measure happens only when width or content (showInfo/surahName) changes.
 *  - Both interpolations are useMemo'd and the parallel run lives in an effect keyed only on
 *    [visible] (+ stable refs), so parent re-renders never restart the animation.
 *
 * USED BY: src/screens/QuranViewScreen.tsx:19 (import), :508 (render)
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing, LayoutChangeEvent, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TutorialAnchor from '../../tutorial/TutorialAnchor';
import Svg, { Path, Circle } from 'react-native-svg';

// Per-button accent colors; MISTAKES is #FF3B30 — same as MISTAKE_COLOR in constants.ts.
const ACCENT = '#1C3D72';
const C_MISTAKES = '#FF3B30';
const C_SHARE = '#1C3D72';
const C_NOTES = '#FF9F0A';
const C_BOOKMARKS = '#FFD700';
const C_SETTINGS = '#8A8A8A';

/**
 * PROPS — all data/callbacks supplied by QuranViewScreen.tsx:
 *   visible: 1 = show / 0 = hide — drives the parallel slide-up + height-collapse animation.
 *   surahName: current surah display name (header title).
 *   surahId: used for the "Surah N ☰" subtitle under the title.
 *   nightMode: theme switch — background (#1a1a2e / #f5f5f5), title and subtitle colors.
 *   onBack → navigate('Dashboard'); onOpenList → setShowList(true) (in-screen surah list);
 *   onMistakes → 'Mistakes'; onShare → handleSharePage (screenshot via viewShot + Share.open); onNotes → 'Notes';
 *   onBookmarks → 'Bookmarks'; onSettings → 'Settings'.
 *   NOTE: the SPREAD toggle is NOT in the header anymore — it lives in MushafPageView's bottom-left actionPills (tablet only).
 */
interface Props {
  visible: boolean; surahName: string; surahId: number; nightMode: boolean;
  onBack: () => void; onOpenList: () => void; onMistakes: () => void;
  onShare: () => void; onNotes: () => void; onBookmarks: () => void; onSettings: () => void;
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
    <Path d="M7 3h10v18l-5-3.6V3z" />
  </Svg>
);

/**
 * AnimatedHeader — presentational header that collapses to zero height when `visible` is false, using two parallel Animated.Values.
 * FLOW: 1) `measured` is set from the inner view's onLayout — but ONLY once per (content, windowWidth)
 *          cache key (see `measuredKey` / `onContentLayout`); the collapse/expand animation's own frames
 *          never re-measure, so the height collapse interpolates against the single cached value.
 *       2) Two Animated.Values created once: `native` (drives opacity + translateY) and `layout` (drives the container height).
 *       3) On `visible` change both animate in parallel: 70ms show / 60ms hide, gentle Easing.out(cubic).
 *       4) translateY interpolates -measured → 0, so the content slides up out of the (overflow:hidden) wrapper.
 *       5) heightStyle interpolates 0 → measured; before first successful measure it falls back to undefined (visible) or 0 (hidden).
 *       6) pointerEvents = 'auto'/'none' so a hidden header never intercepts taps.
 * CALLED BY: QuranViewScreen.tsx:508 → rendered with headerInfo + isHeaderVisible + nightMode.
 * AFFECTS: Layout/render only — the `layout` height change pushes/pulls the reader content (the mushaf font
 *          size is separately boosted when hidden, see responsive.ts).
 * NOTES: BOTH values run with useNativeDriver: false (JS-driven). Only the duration was tightened
 *        (70/60ms) — the height prop on this Animated.View forbids any native-driven sibling value
 *        ("Style property height is not supported by native module").
 */
const AnimatedHeader: React.FC<Props> = (p) => {
  const statusBarPad = useSafeAreaInsets().top;
  const { width } = useWindowDimensions();
  const [measured, setMeasured] = useState(0);
  const measuredRef = useRef(0);
  const measuredKey = useRef('');
  const native = useRef(new Animated.Value(p.visible ? 1 : 0)).current;
  const layout = useRef(new Animated.Value(p.visible ? 1 : 0)).current;

  // Cache identity of the content (title) — when this OR the window width changes,
  // the next layout event triggers ONE re-measure; otherwise every layout event is ignored.
  const contentKey = useMemo(() => `${p.surahName}`, [p.surahName]);

  const onContentLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h <= 0) return;
    const key = `${contentKey}|${width}`;
    // Collapse/re-heal frames report heights for the same cached key — never touch the cache here.
    if (measuredKey.current === key && h <= measuredRef.current) return;
    measuredKey.current = key;
    measuredRef.current = h;
    setMeasured(h);
  }, [contentKey, width]);

  // Hide/show: run BOTH values in a single parallel run — slide/fade on `native`, height collapse on `layout`.
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

  // Animated styles derived from the CACHED measured height: slide-up translateY and 0↔measured height collapse.
  // memoized so only a cache change (or visibility flip) recreates the interpolation objects.
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

  const bg = p.nightMode ? '#1a1a2e' : '#f5f5f5';
  const titleColor = p.nightMode ? '#fff' : '#1a1a1a';
  const subColor = p.nightMode ? '#8a8a8a' : '#777';

  // Per-action button: icon above label, padded hit area (48dp touch target — Android's
  // recommended minimum) so presses register even slightly off-center; no border/outline
  // anywhere — the icon + label ARE the button.
  const Btn = ({ icon, label, onPress, labelStyle }: { icon: React.ReactNode; label: string; onPress: () => void; labelStyle?: any }) => (
    <TouchableOpacity style={s.iconBtn} onPress={onPress} activeOpacity={0.5} hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}>
      {icon}
      <Text style={[s.iconLab, labelStyle, { color: subColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Animated.View
      style={[s.wrap, { backgroundColor: bg, borderBottomColor: '#2a2a2a', height: heightStyle, opacity: native }]}
      pointerEvents={p.visible ? 'auto' : 'none'}
    >
      <Animated.View
        style={{ transform: [{ translateY }], paddingTop: statusBarPad }}
        onLayout={onContentLayout}
      >
        <View style={s.topRow}>
          <TouchableOpacity onPress={p.onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={s.backBtn}>
            <IconBack c={p.nightMode ? '#7BA7DB' : ACCENT} />
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
            <TutorialAnchor id="hdr-share"><Btn label="SHARE" icon={<IconShare c={p.nightMode ? '#7BA7DB' : C_SHARE} />} onPress={p.onShare} /></TutorialAnchor>
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
  // SETTINGS sits next to BOOKMARKS; slightly smaller + side margins so the full word always
  // shows and the two labels never touch on narrow screens.
  iconLabTight: { fontSize: 7.5, marginHorizontal: 2 },
});

export default React.memo(AnimatedHeader);