/**
 * FILE: src/screens/MistakesScreen.tsx
 * ROLE: Groups the student's highlighted words into ONE premium card per verse (newest
 *       first); each card shows Date+Time chips (verse's latest highlight createdAt),
 *       the big surah name, a vertical meta stack — one full-width row per item,
 *       label left / value right, hairline separators, in the order Surah → Ayah →
 *       Juz → Page (mushaf Page resolved async from getVersePage(s, v, textStyle),
 *       '…' until loaded; page follows the selected script (uthmani vs indopak); Juz
 *       computed from the JUZ_MAP start points) — and up to 3 color dots (+N more);
 *       tapping deep-links to the verse in QuranView.
 * DEPENDS ON: Redux s.student.studentData.highlights, shape { [verseKey "surah_verse"]:
 *       { highlights: [{wordIndex, color, createdAt}] } }; s.quran.surahNames; s.quran.textStyle;
 *       s.settings.nightMode (theme). SQLite read-only via getVersePage — no writes.
 * USED BY: QuranView toolbar `onMistakes` (QuranViewScreen.tsx:509).
 */
import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { useStudentDataRefresh } from '../hooks/useStudentDataRefresh';
import ScreenHeader from '../components/common/ScreenHeader';
import CollapsibleBannerAd from '../components/ads/CollapsibleBannerAd';
import { formatDate, formatTime, toMillis } from '../utils/format';
import { getVersePage } from '../database/quranData';
import { JUZ_MAP } from '../utils/theme';

/**
 * WHAT: Small labeled meta chip for the card info grid (Surah # / Juz / Page / Ayat).
 * CALLS: none. AFFECTS: UI only.
 */
const MetaChip = ({ label, value, nightMode }: { label: string; value: string; nightMode: boolean }) => (
  <View style={[styles.metaChip, nightMode ? styles.metaChipDark : styles.metaChipLight]}>
    <Text style={styles.metaLabel}>{label}</Text>
    <Text style={[styles.metaValue, nightMode ? styles.metaValueDark : styles.metaValueLight]}>{value}</Text>
  </View>
);

/**
 * WHAT: Resolves the juz of a verse (surahId, verseNum) by scanning JUZ_MAP for the
 *       last entry whose start point is <= the verse (surah before, or same surah
 *       with start ayah <= ayah).
 * CALLS: JUZ_MAP (pure static table).
 * CALLED BY: renderCard — Juz row of the meta stack.
 * AFFECTS: none (pure).
 * NOTES: Same scan approach as getStartJuzOfSurah (utils/theme.ts) but verse-exact.
 */
const juzForVerse = (surahId: number, verseNum: number): number => {
  let juz = 1;
  for (const entry of JUZ_MAP) {
    if (entry.s < surahId || (entry.s === surahId && entry.v <= verseNum)) juz = entry.j;
  }
  return juz;
};

/**
 * WHAT: Screen component: groups the highlights map into one card per verse and renders them newest-first.
 * FLOW: 1) useSelector studentData + surahNames + nightMode. 2) sortedVerses useMemo: per verseKey pick the
 *       LATEST highlight createdAt (toMillis-compared), collect the distinct highlight colors; sort desc by
 *       that latest ts. 3) useEffect: async getVersePageDB per verseKey into a pages state map ('…' until loaded). 
 *       4) handleNavigate splits verseKey on '_' -> Number(s), Number(v); navigate('QuranView', {surahId, scrollToVerse}).
 * 5) Empty state or FlatList: premium card per verse (Date/Time chips, surah name,
 *    vertical meta stack Surah → Ayah → Juz → Page, color dots).
 * CALLS: handleNavigate -> navigation.navigate('QuranView', {surahId, scrollToVerse}); getVersePageDB (read-only).
 * CALLED BY: React Navigation; opened via QuranViewScreen.tsx:509.
 * AFFECTS: Navigation only.
 * NOTES: ONE CARD PER VERSE (was one row per word) — the same word re-highlighted yields multiple highlights
 *       entries in one verse: the latest createdAt drives the chips/sort, and every highlight's color is
 *       rendered as a dot (duplicates possible). Highlights with no createdAt sort last (toMillis=0) and render
 *       without Date/Time chips. Page lookup is best-effort: missing/0 -> '…'.
 */
export default function MistakesScreen({ onClose, navigation: navProp }: { onClose?: () => void; navigation?: any } = {}) {
  const navigation = navProp || useNavigation<any>();
  const nightMode = useSelector((s: any) => s.settings?.nightMode);
  const studentData = useSelector((s: any) => s.student.studentData);
  const surahNames = useSelector((s: any) => s.quran.surahNames);
  const textStyle = useSelector((s: any) => s.quran.textStyle);
  useStudentDataRefresh();

  /**
   * WHAT: Builds the sorted per-verse list from the highlights map.
   * FLOW: 1) Object.entries(highlights), drop empty verses. 2) Per verse: latest = max createdAt highlight
   *       (toMillis), colors = all highlight colors (non-falsy). 3) Sort desc by latest createdAt.
   * CALLS: toMillis (pure).
   * CALLED BY: Component render.
   * AFFECTS: FlatList data; empty-state condition; page-load effect.
   * NOTES: Keyed on studentData?.highlights; re-runs when highlights change.
   */
  const sortedVerses = React.useMemo(() => {
    const highlights = studentData?.highlights ? Object.entries(studentData.highlights) : [];
    const verses = highlights
      .filter(([, data]: any) => data?.highlights && data.highlights.length > 0)
      .map(([verseKey, data]: any) => {
        const hs = data.highlights;
        const latest = hs.reduce((a: any, b: any) => (toMillis(b.createdAt) > toMillis(a.createdAt) ? b : a), hs[0]);
        return { verseKey, latest, colors: Array.from(new Set(hs.map((h: any) => h.color).filter(Boolean))) };
      });
    return verses.sort((a: any, b: any) => toMillis(b.latest.createdAt) - toMillis(a.latest.createdAt));
  }, [studentData?.highlights]);

  /**
* WHAT: Resolves the mushaf page for each verse card, once per verseKey (re-resolves
 *       when the script textStyle changes — indopak and uthmani number pages differently).
 * FLOW: For each verseKey not yet requested, getVersePage(s, v, textStyle) -> setPages map (0 stays '…').
 * CALLS: getVersePage (read-only SQLite / in-memory indopak map).
 * CALLED BY: Component mount / when sortedVerses or the script changes.
 * AFFECTS: pages state; Page chip rendering.
 * NOTES: Best-effort; a request ref guards against re-fetching after every setPages tick
 *       and is pruned when a verse's card leaves the list.
 */
  const [pages, setPages] = React.useState<Record<string, number>>({});
  const pageReq = React.useRef<Set<string>>(new Set());
  React.useEffect(() => {
    let active = true;
    // Prune requested keys that no longer have a card (highlight removed since).
    const alive = new Set(sortedVerses.map((v: any) => v.verseKey));
    for (const k of pageReq.current) if (!alive.has(k)) pageReq.current.delete(k);
    for (const { verseKey } of sortedVerses) {
      if (pageReq.current.has(verseKey)) continue;
      pageReq.current.add(verseKey);
      const [s, v] = verseKey.split('_').map(Number);
      getVersePage(s, v, textStyle).then((pg) => {
        if (active && pg > 0) setPages((prev) => ({ ...prev, [verseKey]: pg }));
      });
    }
    return () => { active = false; };
  }, [sortedVerses, textStyle]);

  /**
   * WHAT: Deep-links to the verse containing the tapped mistake.
   * FLOW: split verseKey on '_' -> Number(s), Number(v); navigation.navigate('QuranView', { surahId: s, scrollToVerse: v }).
   * CALLS: navigation.navigate.
   * CALLED BY: Card onPress in FlatList renderItem.
   * AFFECTS: Navigation.
   * NOTES: Scrolling only — no word/verse param to re-highlight the word in QuranView.
   */
  const handleNavigate = (vKey: string) => {
    const [s, v] = vKey.split('_').map(Number);
    navigation.navigate('QuranView' as any, { surahId: s, scrollToVerse: v } as any);
  };

  const theme = {
    screenBg: nightMode ? '#0f0f1e' : '#f4f6fb',
    cardBg: nightMode ? '#1a1a2e' : '#fff',
    cardBorder: nightMode ? '#2a2a4a' : '#e2e5f0',
    text: nightMode ? '#fff' : '#1a1a1a',
    sub: nightMode ? '#8a8a8a' : '#6b6b76',
    chipBg: nightMode ? '#232345' : '#f1f4fb',
    accentSoft: nightMode ? 'rgba(123,167,219,0.16)' : 'rgba(28,61,114,0.10)',
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
        <View style={styles.titleRow}>
          <Text style={[styles.surahName, { color: nightMode ? '#7BA7DB' : '#1C3D72' }]} numberOfLines={1}>{name}</Text>
          <Text style={[styles.chevron, { color: nightMode ? '#7BA7DB' : '#1C3D72' }]}>›</Text>
        </View>
        <View style={styles.metaRow}>
          <MetaChip label="Surah #" value={String(s)} nightMode={nightMode} />
          <MetaChip label="Juz" value={String(juz)} nightMode={nightMode} />
          <MetaChip label="Page" value={page > 0 ? String(page) : '…'} nightMode={nightMode} />
          <MetaChip label="Ayat" value={String(v)} nightMode={nightMode} />
        </View>
        {dots.length > 0 || extra > 0 ? (
          <View style={styles.dotsRow}>
            {dots.map((c: string, i: number) => (
              <View key={i} style={[styles.dot, { backgroundColor: c, borderColor: theme.dotBorder }]} />
            ))}
            {extra > 0 ? <Text style={[styles.moreText, { color: theme.sub }]}>+{extra} more</Text> : null}
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.screenBg }]}>
      <ScreenHeader title="Mistakes" subtitle={`${sortedVerses.length} highlighted verse${sortedVerses.length === 1 ? '' : 's'} · newest first`} onBack={onClose} />
      {sortedVerses.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>✏️</Text>
          <Text style={[styles.emptyText, { color: theme.sub }]}>No mistakes highlighted yet</Text>
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
  list: { padding: 10, paddingBottom: 16 },
  card: { borderRadius: 12, borderWidth: 1, padding: 10, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 2 },
  chipsRow: { flexDirection: 'row', marginBottom: 5 },
  chip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, marginRight: 6 },
  chipText: { fontSize: 9, fontWeight: '600' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  surahName: { fontSize: 15, fontWeight: '800' },
  chevron: { fontSize: 20, fontWeight: '400', opacity: 0.7, marginTop: -2 },
  metaRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  metaChip: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  metaChipDark: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.08)' },
  metaChipLight: { backgroundColor: '#f4f5fb', borderColor: '#e5e7f2' },
  metaLabel: { color: '#9aa0b5', fontSize: 8, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  metaValue: { fontSize: 11, fontWeight: '800', marginTop: 1 },
  metaValueDark: { color: '#ffffff' },
  metaValueLight: { color: '#1a1a2e' },
  dotsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, marginRight: 6 },
  moreText: { fontSize: 9, fontWeight: '600' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '600' },
  emptySub: { fontSize: 12, marginTop: 4 },
});
