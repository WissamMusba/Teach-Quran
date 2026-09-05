/**
 * FILE: src/screens/MistakesScreen.tsx
 * ROLE: Groups the student's highlighted words into ONE premium card per verse with pure vector SVG icons and theme support.
 */
import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import { useStudentDataRefresh } from '../hooks/useStudentDataRefresh';
import ScreenHeader from '../components/common/ScreenHeader';
import CollapsibleBannerAd from '../components/ads/CollapsibleBannerAd';
import { formatDate, formatTime, toMillis } from '../utils/format';
import { getVersePage } from '../database/quranData';
import { JUZ_MAP, getThemeColors } from '../utils/theme';

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

export default function MistakesScreen({ onClose, navigation: navProp }: { onClose?: () => void; navigation?: any } = {}) {
  const navigation = navProp || useNavigation<any>();
  const nightMode = useSelector((s: any) => s.settings?.nightMode);
  const studentData = useSelector((s: any) => s.student.studentData);
  const surahNames = useSelector((s: any) => s.quran.surahNames);
  const textStyle = useSelector((s: any) => s.quran.textStyle);

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

  const [pages, setPages] = React.useState<Record<string, number>>({});

  React.useEffect(() => {
    let active = true;
    for (const item of sortedVerses) {
      const verseKey = item.verseKey;
      const [s, v] = verseKey.split('_').map(Number);
      getVersePage(s, v, textStyle).then((pg) => {
        if (active && pg > 0) setPages((prev) => ({ ...prev, [verseKey]: pg }));
      });
    }
    return () => { active = false; };
  }, [sortedVerses, textStyle]);

  const handleNavigate = (vKey: string) => {
    const [s, v] = vKey.split('_').map(Number);
    navigation.navigate('QuranView' as any, { surahId: s, scrollToVerse: v } as any);
  };

  const colorTheme = useSelector((s: any) => s.settings?.colorTheme || 'classic');
  const themeColors = React.useMemo(() => getThemeColors(colorTheme, nightMode), [colorTheme, nightMode]);

  const theme = {
    screenBg: themeColors.bg,
    cardBg: themeColors.cardBg,
    cardBorder: themeColors.border,
    text: themeColors.text,
    sub: themeColors.subText,
    chipBg: nightMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
    accentSoft: nightMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
    dotBorder: nightMode ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)',
  };

  const renderCard = ({ item }: any) => {
    const [s, v] = item.verseKey.split('_').map(Number);
    const ts = toMillis(item.latest?.createdAt);
    const date = formatDate(ts);
    const time = formatTime(ts);
    const page = pages[item.verseKey];
    const juz = juzForVerse(s, v);
    const name = surahNames?.[s] || `Surah ${s}`;
    const dots = item.colors.slice(0, 3);
    const extra = item.colors.length - dots.length;
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, shadowOpacity: nightMode ? 0.4 : 0.08 }]}
        onPress={() => handleNavigate(item.verseKey)}
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

        <Text style={[styles.surahName, { color: themeColors.text, borderLeftColor: themeColors.accent }]}>{name}</Text>

        <View style={[styles.metaStack, { backgroundColor: nightMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderColor: theme.cardBorder }]}>
          <View style={styles.metaItem}>
            <Text style={[styles.metaLabel, { color: theme.sub }]}>Surah</Text>
            <Text style={[styles.metaValue, { color: theme.text }]}>{s}</Text>
          </View>
          <View style={[styles.metaSeparator, { backgroundColor: theme.cardBorder }]} />
          <View style={styles.metaItem}>
            <Text style={[styles.metaLabel, { color: theme.sub }]}>Ayah</Text>
            <Text style={[styles.metaValue, { color: theme.text }]}>{v}</Text>
          </View>
          <View style={[styles.metaSeparator, { backgroundColor: theme.cardBorder }]} />
          <View style={styles.metaItem}>
            <Text style={[styles.metaLabel, { color: theme.sub }]}>Juz</Text>
            <Text style={[styles.metaValue, { color: theme.text }]}>{juz}</Text>
          </View>
          <View style={[styles.metaSeparator, { backgroundColor: theme.cardBorder }]} />
          <View style={styles.metaItem}>
            <Text style={[styles.metaLabel, { color: theme.sub }]}>Page</Text>
            <Text style={[styles.metaValue, { color: theme.text }]}>{page !== undefined ? page : '…'}</Text>
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
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.screenBg }]}>
      <ScreenHeader title="Mistakes" subtitle={`${sortedVerses.length} highlighted verse${sortedVerses.length === 1 ? '' : 's'} · newest first`} onBack={onClose} />
      {sortedVerses.length === 0 ? (
        <View style={styles.emptyState}>
          <IconPen c={themeColors.accent} size={44} />
          <Text style={[styles.emptyText, { color: theme.sub, marginTop: 12 }]}>No mistakes highlighted yet</Text>
          <Text style={[styles.emptySub, { color: theme.sub }]}>Highlight a word while reading to mark it</Text>
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={sortedVerses}
          keyExtractor={(item: any) => item.verseKey}
          contentContainerStyle={styles.list}
          renderItem={renderCard}
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
  chipsRow: { flexDirection: 'row', gap: 6, marginBottom: 5, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 9, fontWeight: '700' },
  surahName: { fontSize: 15, fontWeight: '800', borderLeftWidth: 3, paddingLeft: 8, marginBottom: 5 },
  metaStack: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10 },
  metaItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  metaLabel: { fontSize: 10, fontWeight: '600' },
  metaValue: { fontSize: 10, fontWeight: '700' },
  metaSeparator: { height: StyleSheet.hairlineWidth, opacity: 0.5 },
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
