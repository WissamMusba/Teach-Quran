/**
 * FILE: src/screens/BookmarksScreen.tsx
 * ROLE: Lists the current student's bookmarks (newest first) plus a pinned "LAST READ" card;
 *       tapping any item deep-links back into QuranView at that verse.
 * DEPENDS ON: Redux s.student.studentData.bookmarks (keyed `surah_verse`) + studentData.lastRead
 *             (studentData is hydrated only by QuranViewScreen's mount effect via getStudentData
 *             in src/database/localDB.ts — this screen never calls SQLite itself), s.quran.surahNames,
 *             s.settings.nightMode, src/utils/format.ts (formatDate/formatTime/getJuzForVerse),
 *             src/database/localDB.ts (getVersePageDB async page lookup, cached in local state).
 * USED BY: Opened from the QuranView toolbar `onBookmarks` (QuranViewScreen.tsx); NOT
 *          reachable from Dashboard.
 */
import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import ScreenHeader from '../components/common/ScreenHeader';
import { formatDate, formatTime, getJuzForVerse, toMillis } from '../utils/format';
import { getVersePageDB } from '../database/localDB';
import { useStudentDataRefresh } from '../hooks/useStudentDataRefresh';

const ACCENT = '#00d4aa';
const pageKey = (surah: number, verse: number) => `${surah}_${verse}`;

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
 * WHAT: Screen component: derives the sorted bookmark list + last read from Redux, renders
 *       ScreenHeader (fixed, above the list), empty state, pinned card, or FlatList of
 *       premium bookmark cards.
 * FLOW: 1) useSelector s.student.studentData, s.quran.surahNames, s.settings.nightMode;
 *       2) sortedBookmarks useMemo: Object.values(studentData.bookmarks) sorted desc by
 *          createdAt (sort() MUTATES the values array in place);
 *       3) lastRead = studentData?.lastRead;
 *       4) pageMap local state: async getVersePageDB(surah, verse) results keyed
 *          `surah_verse` (looked up on card mount, rendered as "…" until resolved);
 *       5) renderBookmark: onPress -> handleNavigate(item.surah, item.verse);
 *       6) renders pinned "LAST READ" card if lastRead exists, else empty state or FlatList.
 * CALLS: handleNavigate -> navigation.navigate('QuranView', { surahId, scrollToVerse }) — THE
 *        deep-link contract (QuranViewScreen consumes these params); getJuzForVerse /
 *        formatDate / formatTime for badges + timestamps; getVersePageDB for mushaf pages.
 * CALLED BY: React Navigation (registered in the root stack; opened via QuranViewScreen.tsx
 *            toolbar onBookmarks).
 * AFFECTS: Redux: none. Navigation: pushes QuranView with {surahId, scrollToVerse}.
 * NOTES: keyExtractor uses the array index — safe here (no reordering between renders) but
 *        fragile if deletes are added. If studentData is null (QuranView never mounted this
 *        session), both lists render empty — no loading/refresh path in this screen. The
 *        empty-state hint "Long-press a verse to bookmark it" refers to QuranViewScreen's
 *        handleBookmarkFlow, not to any action in this screen.
 */
export default function BookmarksScreen() {
  useStudentDataRefresh();
  const navigation = useNavigation<any>();
  const studentData = useSelector((s: any) => s.student.studentData);
  const surahNames = useSelector((s: any) => s.quran.surahNames);
  const nightMode = !!useSelector((s: any) => s.settings?.nightMode);

  const [pageMap, setPageMap] = useState<Record<string, number>>({});

  const ensurePage = (surah: number, verse: number) => {
    const key = pageKey(surah, verse);
    if (pageMap[key] !== undefined) return;
    getVersePageDB(surah, verse).then((page) => {
      setPageMap((prev) => (prev[key] !== undefined ? prev : { ...prev, [key]: page }));
    });
  };

  const sortedBookmarks = React.useMemo(() => {
    const bookmarks = studentData?.bookmarks ? Object.values(studentData.bookmarks) : [];
    return bookmarks.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [studentData?.bookmarks]);
  const lastRead = studentData?.lastRead;

  const handleNavigate = (surah: number, verse: number) => navigation.navigate('QuranView' as any, { surahId: surah, scrollToVerse: verse } as any);

  const renderBookmark = ({ item }: any) => {
    ensurePage(item.surah, item.verse);
    const juz = getJuzForVerse(item.surah, item.verse);
    const name = surahNames?.[item.surah] || `Surah ${item.surah}`;
    const page = pageMap[pageKey(item.surah, item.verse)];
    return (
      <TouchableOpacity
        style={[styles.card, nightMode ? styles.cardDark : styles.cardLight]}
        onPress={() => handleNavigate(item.surah, item.verse)}
        activeOpacity={0.7}
      >
        <View style={styles.topRow}>
          <View style={[styles.chip, styles.chipDate, nightMode ? styles.chipDateDark : styles.chipDateLight]}>
            <Text style={[styles.chipText, nightMode ? styles.chipDateTextDark : styles.chipDateTextLight]}>
              Date: {formatDate(item.createdAt)}
            </Text>
          </View>
          <View style={[styles.chip, styles.chipTime, nightMode ? styles.chipTimeDark : styles.chipTimeLight]}>
            <Text style={[styles.chipText, nightMode ? styles.chipTimeTextDark : styles.chipTimeTextLight]}>
              Time: {formatTime(item.createdAt)}
            </Text>
          </View>
        </View>
        <View style={styles.titleRow}>
          <Text style={styles.surahName}>{name}</Text>
          <Text style={styles.chevron}>›</Text>
        </View>
        <View style={styles.metaRow}>
          <MetaChip label="Surah #" value={String(item.surah)} nightMode={nightMode} />
          <MetaChip label="Juz" value={String(juz)} nightMode={nightMode} />
          <MetaChip label="Page" value={page !== undefined && page > 0 ? String(page) : '…'} nightMode={nightMode} />
          <MetaChip label="Ayat" value={String(item.verse)} nightMode={nightMode} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderPinned = () => {
    if (!lastRead) return null;
    ensurePage(lastRead.surah, lastRead.verse);
    const name = surahNames?.[lastRead.surah] || `Surah ${lastRead.surah}`;
    const juz = getJuzForVerse(lastRead.surah, lastRead.verse);
    const page = pageMap[pageKey(lastRead.surah, lastRead.verse)];
    const ts = toMillis(lastRead.updatedAt || lastRead.createdAt);
    return (
      <TouchableOpacity
        style={[styles.card, nightMode ? styles.cardDark : styles.cardLight]}
        onPress={() => handleNavigate(lastRead.surah, lastRead.verse)}
        activeOpacity={0.7}
      >
        {ts ? (
          <View style={styles.topRow}>
            <View style={[styles.chip, styles.chipDate, nightMode ? styles.chipDateDark : styles.chipDateLight]}>
              <Text style={[styles.chipText, nightMode ? styles.chipDateTextDark : styles.chipDateTextLight]}>
                Date: {formatDate(ts)}
              </Text>
            </View>
            <View style={[styles.chip, styles.chipTime, nightMode ? styles.chipTimeDark : styles.chipTimeLight]}>
              <Text style={[styles.chipText, nightMode ? styles.chipTimeTextDark : styles.chipTimeTextLight]}>
                Time: {formatTime(ts)}
              </Text>
            </View>
          </View>
        ) : null}
        <View style={styles.titleRow}>
          <Text style={styles.lastReadTag}>LAST READ</Text>
          {!ts ? <Text style={styles.verseNum}>Ayat {lastRead.verse}</Text> : null}
          <Text style={styles.chevron}>›</Text>
        </View>
        <Text style={styles.surahName}>{name}</Text>
        {ts ? (
          <View style={styles.metaRow}>
            <MetaChip label="Surah #" value={String(lastRead.surah)} nightMode={nightMode} />
            <MetaChip label="Juz" value={String(juz)} nightMode={nightMode} />
            <MetaChip label="Page" value={page !== undefined && page > 0 ? String(page) : '…'} nightMode={nightMode} />
            <MetaChip label="Ayat" value={String(lastRead.verse)} nightMode={nightMode} />
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, nightMode ? styles.containerDark : styles.containerLight]}>
      <ScreenHeader title="Bookmarks" subtitle={`${sortedBookmarks.length} saved`} />
      {renderPinned()}
      {sortedBookmarks.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📌</Text>
          <Text style={styles.emptyText}>No bookmarks yet</Text>
          <Text style={styles.emptySub}>Long-press a verse to bookmark it</Text>
        </View>
      ) : (
        <FlatList
          data={sortedBookmarks}
          keyExtractor={(i: any, idx: number) => idx.toString()}
          contentContainerStyle={styles.list}
          renderItem={renderBookmark}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  containerDark: { backgroundColor: '#121212' },
  containerLight: { backgroundColor: '#f5f5f5' },
  list: { paddingBottom: 20 },
  card: { padding: 16, borderRadius: 16, marginBottom: 14, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  cardDark: { backgroundColor: '#1a1a2e', borderColor: '#2a2a4a' },
  cardLight: { backgroundColor: '#ffffff', borderColor: '#e5e7f2' },
  topRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  chipDate: {},
  chipTime: {},
  chipDateDark: { backgroundColor: 'rgba(0,212,170,0.12)' },
  chipDateLight: { backgroundColor: '#e6f8f4' },
  chipTimeDark: { backgroundColor: 'rgba(139,92,246,0.14)' },
  chipTimeLight: { backgroundColor: '#f1ecfe' },
  chipText: { fontSize: 11, fontWeight: '700' },
  chipDateTextDark: { color: '#2ee6bd' },
  chipDateTextLight: { color: '#0b8f77' },
  chipTimeTextDark: { color: '#a78bfa' },
  chipTimeTextLight: { color: '#7c3aed' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  surahName: { color: ACCENT, fontSize: 20, fontWeight: '800', marginTop: 2 },
  verseNum: { color: '#888', fontSize: 13, fontWeight: '600' },
  chevron: { color: ACCENT, fontSize: 26, fontWeight: '400', opacity: 0.7, marginTop: -2 },
  lastReadTag: { alignSelf: 'flex-start', color: ACCENT, backgroundColor: 'rgba(0,212,170,0.12)', fontSize: 9, fontWeight: '800', letterSpacing: 1.2, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  metaRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  metaChip: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  metaChipDark: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.08)' },
  metaChipLight: { backgroundColor: '#f4f5fb', borderColor: '#e5e7f2' },
  metaLabel: { color: '#9aa0b5', fontSize: 9, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  metaValue: { fontSize: 14, fontWeight: '800', marginTop: 2 },
  metaValueDark: { color: '#ffffff' },
  metaValueLight: { color: '#1a1a2e' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#888', fontSize: 16, fontWeight: '600' },
  emptySub: { color: '#555', fontSize: 12, marginTop: 4 },
});
