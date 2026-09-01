/**
 * FILE: src/components/common/AnimatedHeader.tsx
 * ROLE: The Quran reader's top bar — surah name + share/bookmark buttons + 3-line hamburger menu.
 *       Full dynamic theme palette integration (Classic Royal Navy, Madinah Emerald, OLED Obsidian).
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing, LayoutChangeEvent, useWindowDimensions, Modal, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import TutorialAnchor from '../../tutorial/TutorialAnchor';
import Svg, { Path, Circle } from 'react-native-svg';
import { getThemeColors } from '../../utils/theme';

const C_MISTAKES = '#FF3B30';
const C_NOTES = '#FF9F0A';
const C_BOOKMARKS = '#FFD700';

interface Props {
  visible: boolean; surahName: string; surahId: number; nightMode: boolean;
  onBack: () => void; onOpenList: () => void; onMistakes: () => void;
  onShare: () => void; onNotes: () => void; onBookmarks: () => void; onSettings: () => void;
}

const st = { fill: 'none' as const, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const IconBack = ({ c }: { c: string }) => (
  <Svg width={28} height={28} viewBox="0 0 24 24" {...st} stroke={c}><Path d="M15 4.5L7.5 12l7.5 7.5" /></Svg>
);

const IconShare = ({ c }: any) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" {...st} stroke={c}><Path d="M12 14V4" /><Path d="M8 8l4-4 4 4" /><Path d="M5 11v9h14v-9" /></Svg>
);

const IconHamburger = ({ c }: { c: string }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 12h18M3 6h18M3 18h18" />
  </Svg>
);

const IconPen = ({ c }: any) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" {...st} stroke={c} style={{ marginRight: 10 }}><Path d="M14 4l3 3-9 9-3 1 1-3 8-8z" /></Svg>
);

const IconNote = ({ c }: any) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" {...st} stroke={c} style={{ marginRight: 10 }}><Path d="M6 3h12v18l-4-2-4 2-4-2-2 2V3z" /><Path d="M9 8h6M9 12h6" /></Svg>
);

const IconSettings = ({ c }: any) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" {...st} stroke={c} style={{ marginRight: 10 }}><Circle cx="12" cy="12" r="3.2" /><Path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" /></Svg>
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
  const [menuOpen, setMenuOpen] = useState(false);

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
    <>
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
                  {`Surah ${p.surahId} ▾`}
                </Text>
              </TouchableOpacity>
            </TutorialAnchor>

            <View style={s.iconsRow}>
              <TutorialAnchor id="hdr-share">
                <Btn label="SHARE" icon={<IconShare c={primaryAccent} />} onPress={p.onShare} />
              </TutorialAnchor>
              <Btn label="BOOKMARKS" icon={<BookmarkIcon c={C_BOOKMARKS} size={20} />} onPress={p.onBookmarks} />

              <TutorialAnchor id="hdr-menu">
                <TouchableOpacity
                  style={s.hamburgerBtn}
                  onPress={() => setMenuOpen(true)}
                  activeOpacity={0.6}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <IconHamburger c={primaryAccent} />
                </TouchableOpacity>
              </TutorialAnchor>
            </View>
          </View>
        </Animated.View>
      </Animated.View>

      {/* Top-Right Hamburger Dropdown Menu Modal */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={s.menuOverlay} onPress={() => setMenuOpen(false)}>
          <View style={[s.menuPopup, { backgroundColor: themeColors.cardBg, borderColor: themeColors.border, top: statusBarPad + 48 }]}>
            <TouchableOpacity
              style={[s.menuItem, { borderBottomColor: themeColors.border }]}
              onPress={() => { setMenuOpen(false); p.onNotes(); }}
              activeOpacity={0.7}
            >
              <IconNote c={C_NOTES} />
              <Text style={[s.menuText, { color: themeColors.text }]}>Notes</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.menuItem, { borderBottomColor: themeColors.border }]}
              onPress={() => { setMenuOpen(false); p.onMistakes(); }}
              activeOpacity={0.7}
            >
              <IconPen c={C_MISTAKES} />
              <Text style={[s.menuText, { color: themeColors.text }]}>Mistakes</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.menuItem, { borderBottomWidth: 0 }]}
              onPress={() => { setMenuOpen(false); p.onSettings(); }}
              activeOpacity={0.7}
            >
              <IconSettings c={themeColors.accent} />
              <Text style={[s.menuText, { color: themeColors.text }]}>Settings</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

const s = StyleSheet.create({
  wrap: { borderBottomWidth: 1, zIndex: 100, overflow: 'hidden' },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingTop: 4, paddingBottom: 4 },
  backBtn: { minHeight: 42, minWidth: 44, alignItems: 'center', justifyContent: 'center', marginRight: 2 },
  titleBlock: { flex: 1, paddingVertical: 1 },
  surahName: { fontSize: 16, fontWeight: 'bold' },
  surahSub: { fontSize: 10.5, marginTop: 1, fontWeight: '500' },
  iconsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: { minWidth: 46, minHeight: 38, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  iconLab: { fontSize: 8.5, fontWeight: '700', marginTop: 2, letterSpacing: 0.2 },
  hamburgerBtn: { minWidth: 42, minHeight: 38, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  menuPopup: { position: 'absolute', right: 12, width: 160, borderRadius: 14, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 8, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  menuText: { fontSize: 14, fontWeight: '600' },
});

export default AnimatedHeader;
