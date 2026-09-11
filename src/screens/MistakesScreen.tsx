/**
 * FILE: src/screens/MistakesScreen.tsx
 * ROLE: Groups the student's highlighted words into ONE premium card per verse with pure vector SVG icons and theme support.
 */
import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import { useStudentDataRefresh } from '../hooks/useStudentDataRefresh';
import ScreenHeader from '../components/common/ScreenHeader';
import CollapsibleBannerAd from '../components/ads/CollapsibleBannerAd';
import { formatDate, formatTime, toMillis } from '../utils/format';
import { getVersePage } from '../database/quranData';
import { getVersePagesDB } from '../database/localDB';
import { JUZ_MAP, getThemeColors } from '../utils/theme';

const sessionPageCache: Record<string, number> = {};

const IconPen = ({ c, size = 20 }: { c: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 19l7-7 3 3-7 7-3-3z" />
    <Path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
    <Path d="M2 2l7.586 7.586" />
    <Path d="M11 11a2 2 0 1 0 2 2" />
  </Svg>
);

const MetaChip = ({ label, value, nightMode }: { label: string; value: string; nightMode: boolean }) => (
  <View style={[styles.metaChip, nightMode ? styles.metaChipDark : styles.metaChipLight]}>
    <Text style={styles.metaLabel}>{label}</Text>
    <Text style={[styles.metaValue, nightMode ? styles.metaValueDark : styles.metaValueLight]}>{value}</Text>
  </View>
);

const juzForVerse = (surahId: number, verseNum: number): number => {
  let juz = 1;
  for (const entry of JUZ_MAP) {
    if (entry.s < surahId || (entry.s === surahId && entry.v <= verseNum)) juz = entry.j;
  }
  return juz;
};

interface MistakeCardProps {
  item: any;
  page?: number;
  surahName: string;
  theme: any;
  themeColors: any;
  nightMode: boolean;
  isTablet: boolean;
  onNavigate: (verseKey: string, page?: number) => void;
}

const MistakeCard = React.memo(({ item, page, surahName, theme, themeColors, nightMode, isTablet, onNavigate }: MistakeCardProps) => {
  const [s, v] = item.verseKey.split('_').map(Number);
  const ts = toMillis(item.latest?.createdAt);
  const date = formatDate(ts);
  const time = formatTime(ts);
  const juz = juzForVerse(s, v);
  const dots = item.colors.slice(0, 3);
  const extra = item.colors.length - dots.length;
  return (
    <TouchableOpacity
      style={[
        styles.card,
        isTablet ? styles.cardTablet : undefined,
        { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, shadowOpacity: nightMode ? 0.4 : 0.08 }
      ]}
      onPress={() => onNavigate(item.verseKey, page)}
      activeOpacity={0.85}
    >
      {(date || time) ? (
        <View style={styles.chipsRow}>
          {date ? (
            <View style={[styles.chip, { backgroundColor: theme.accentSoft, borderColor: theme.accentSoft }]}>
              <Text style={[styles.chipText, { color: theme.text }]}>Date: {date}</Text>
            </View>
          ) : null}
          {time ? (
            <View style={[styles.chip, { backgroundColor: theme.accentSoft, borderColor: theme.accentSoft }]}>
              <Text style={[styles.chipText, { color: theme.text }]}>Time: {time}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <Text style={[styles.surahName, { color: themeColors.text, borderLeftColor: themeColors.accent }]}>{surahName}</Text>

      <View style={[styles.metaGrid, { backgroundColor: nightMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderColor: theme.cardBorder }]}>
        {/* Row 1: Juz (label left, value right) | Vertical Separator | Page (label left, value right) */}
        <View style={styles.metaRow}>
          <View style={styles.metaCell}>
            <Text style={[styles.metaLabel, { color: theme.sub }]}>Juz</Text>
            <Text style={[styles.metaValue, { color: theme.text }]}>{juz}</Text>
          </View>
          <View style={[styles.metaColSeparator, { backgroundColor: theme.cardBorder }]} />
          <View style={styles.metaCell}>
            <Text style={[styles.metaLabel, { color: theme.sub }]}>Page</Text>
            <Text style={[styles.metaValue, { color: theme.text }]}>{page !== undefined ? page : '…'}</Text>
          </View>
        </View>

        {/* Horizontal Separator line */}
        <View style={[styles.metaRowSeparator, { backgroundColor: theme.cardBorder }]} />

        {/* Row 2: Surah (label left, value right) | Vertical Separator | Ayah (label left, value right) */}
        <View style={styles.metaRow}>
          <View style={styles.metaCell}>
            <Text style={[styles.metaLabel, { color: theme.sub }]}>Surah</Text>
            <Text style={[styles.metaValue, { color: theme.text }]}>{s}</Text>
          </View>
          <View style={[styles.metaColSeparator, { backgroundColor: theme.cardBorder }]} />
          <View style={styles.metaCell}>
            <Text style={[styles.metaLabel, { color: theme.sub }]}>Ayah</Text>
            <Text style={[styles.metaValue, { color: theme.text }]}>{v}</Text>
          </View>
        </View>
      </View>

      {dots.length > 0 && (
        <View style={styles.dotsRow}>
          {dots.map((c: string, idx: number) => (
            <View key={idx} style={[styles.colorDot, { backgroundColor: c, borderColor: theme.dotBorder }]} />
          ))}
          {extra > 0 && (
            <View style={[styles.extraChip, { backgroundColor: theme.chipBg, borderColor: theme.cardBorder }]}>
              <Text style={[styles.extraText, { color: theme.sub }]}>+{extra}</Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
});

export default function MistakesScreen({ onClose, navigation: navProp }: { onClose?: () => void; navigation?: any } = {}) {
  const navigation = navProp || useNavigation<any>();
  const nightMode = useSelector((s: any) => s.settings?.nightMode);
  const studentData = useSelector((s: any) => s.student.studentData);
  const surahNames = useSelector((s: any) => s.quran.surahNames);
  const textStyle = useSelector((s: any) => s.quran.textStyle);
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  useStudentDataRefresh();

  const sortedVerses = React.useMemo(() => {
    const raw = studentData?.highlights || {};
    const list = Object.entries(raw).map(([verseKey, val]: [string, any]) => {
      const arr = val?.highlights || [];
      let latestTs = 0;
      let latestObj: any = null;
      const colorsSet = new Set<string>();
      for (const h of arr) {
        if (h?.color) colorsSet.add(h.color);
        const t = toMillis(h?.createdAt);
        if (t >= latestTs) { latestTs = t; latestObj = h; }
      }
      return { verseKey, latest: latestObj, colors: Array.from(colorsSet) };
    });
    list.sort((a, b) => toMillis(b.latest?.createdAt) - toMillis(a.latest?.createdAt));
    return list;
  }, [studentData?.highlights]);

  // Maintain previously rendered cards during background page updates so it never flickers to 'No mistakes highlighted yet'
  const prevVersesRef = React.useRef<typeof sortedVerses>([]);
  if (sortedVerses.length > 0) {
    prevVersesRef.current = sortedVerses;
  }
  const displayVerses = sortedVerses.length > 0 ? sortedVerses : prevVersesRef.current;

  const [pages, setPages] = React.useState<Record<string, number>>(() => ({ ...sessionPageCache }));

  React.useEffect(() => {
    let active = true;
    const entries: [number, number][] = [];
    for (const item of displayVerses) {
      const [s, v] = item.verseKey.split('_').map(Number);
      if (s > 0 && v > 0) entries.push([s, v]);
    }
    if (entries.length === 0) return;

    getVersePagesDB(entries).then((res) => {
      if (active && res) {
        Object.assign(sessionPageCache, res);
        setPages((prev) => ({ ...prev, ...res }));
      }
    }).catch(() => {});

    return () => { active = false; };
  }, [displayVerses, textStyle]);

  const handleNavigate = React.useCallback((vKey: string, page?: number) => {
    const [s, v] = vKey.split('_').map(Number);
    const targetPage = page || pages[vKey] || sessionPageCache[vKey];
    if (targetPage) {
      navigation.navigate('QuranView' as any, {
        page: targetPage,
        surahId: s,
        scrollToVerse: v,
        t: Date.now(),
      } as any);
      return;
    }
    getVersePage(s, v, textStyle)
      .then((pg) => {
        if (pg) sessionPageCache[vKey] = pg;
        navigation.navigate('QuranView' as any, {
          page: pg || 1,
          surahId: s,
          scrollToVerse: v,
          t: Date.now(),
        } as any);
      })
      .catch(() => {
        navigation.navigate('QuranView' as any, {
          page: 1,
          surahId: s,
          scrollToVerse: v,
          t: Date.now(),
        } as any);
      });
  }, [navigation, pages, textStyle]);

  const colorTheme = useSelector((s: any) => s.settings?.colorTheme || 'classic');
  const themeColors = React.useMemo(() => getThemeColors(colorTheme, nightMode), [colorTheme, nightMode]);

  const theme = React.useMemo(() => ({
    screenBg: themeColors.bg,
    cardBg: themeColors.cardBg,
    cardBorder: themeColors.border,
    text: themeColors.text,
    sub: themeColors.subText,
    chipBg: nightMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
    accentSoft: nightMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
    dotBorder: nightMode ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)',
  }), [themeColors, nightMode]);

  const renderCard = React.useCallback(({ item }: any) => {
    const [s] = item.verseKey.split('_').map(Number);
    const surahName = surahNames?.[s] || `Surah ${s}`;
    return (
      <MistakeCard
        item={item}
        page={pages[item.verseKey]}
        surahName={surahName}
        theme={theme}
        themeColors={themeColors}
        nightMode={nightMode}
        isTablet={isTablet}
        onNavigate={handleNavigate}
      />
    );
  }, [surahNames, pages, theme, themeColors, nightMode, isTablet, handleNavigate]);

  return (
    <View style={[styles.container, { backgroundColor: theme.screenBg }]}>
      <ScreenHeader title="Mistakes" subtitle={`${displayVerses.length} highlighted verse${displayVerses.length === 1 ? '' : 's'} · newest first`} onBack={onClose} />
      {displayVerses.length === 0 ? (
        <View style={styles.emptyState}>
          <IconPen c={themeColors.accent} size={44} />
          <Text style={[styles.emptyText, { color: theme.sub, marginTop: 12 }]}>No mistakes highlighted yet</Text>
          <Text style={[styles.emptySub, { color: theme.sub }]}>Highlight a word while reading to mark it</Text>
        </View>
      ) : (
        <FlatList
          key={isTablet ? 'tablet-grid' : 'single-col'}
          style={{ flex: 1 }}
          data={displayVerses}
          keyExtractor={(item: any) => item.verseKey}
          contentContainerStyle={styles.list}
          renderItem={renderCard}
          numColumns={isTablet ? 2 : 1}
          columnWrapperStyle={isTablet ? { gap: 10 } : undefined}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
        />
      )}
      <CollapsibleBannerAd />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 10, paddingBottom: 12 },
  card: { padding: 10, borderRadius: 12, marginBottom: 8, borderWidth: 1, shadowColor: '#000', shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardTablet: { flex: 1 },
  chipsRow: { flexDirection: 'row', gap: 6, marginBottom: 5, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 9, fontWeight: '700' },
  surahName: { fontSize: 15, fontWeight: '800', borderLeftWidth: 3, paddingLeft: 8, marginBottom: 5 },
  metaGrid: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2 },
  metaCell: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 },
  metaColSeparator: { width: StyleSheet.hairlineWidth, height: 16, opacity: 0.5, marginHorizontal: 4 },
  metaRowSeparator: { height: StyleSheet.hairlineWidth, opacity: 0.5 },
  metaLabel: { fontSize: 11, fontWeight: '600' },
  metaValue: { fontSize: 12.5, fontWeight: '700' },
  metaChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginRight: 6, marginBottom: 6 },
  metaChipDark: { backgroundColor: '#232345' },
  metaChipLight: { backgroundColor: '#f1f4fb' },
  metaValueDark: { color: '#ffffff' },
  metaValueLight: { color: '#1a1a1a' },
  dotsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5, gap: 5 },
  colorDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1 },
  extraChip: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 999, borderWidth: 1 },
  extraText: { fontSize: 9, fontWeight: '700' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16, fontWeight: '600' },
  emptySub: { fontSize: 12, marginTop: 4 },
});
