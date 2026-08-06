/**
 * FILE: src/screens/BookmarksScreen.tsx
 * ROLE: Lists the current student's bookmarks (newest first) plus a pinned "LAST READ" card;
 *       tapping any item deep-links back into QuranView at that verse.
 * DEPENDS ON: Redux s.student.studentData.bookmarks (keyed `surah_verse`) + studentData.lastRead
 *             (studentData is hydrated by QuranViewScreen's mount effect via getStudentData in
 *             src/database/localDB.ts; this screen re-hydrates itself on focus through the SAME
 *             getStudentData, so cloud pulls and chunk-only writes reach the list), s.quran.surahNames,
 *             src/utils/theme.ts (JUZ_MAP).
 * USED BY: Opened from the QuranView toolbar `onBookmarks` (QuranViewScreen.tsx:1073); NOT
 *          reachable from Dashboard.
 */
import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { JUZ_MAP } from '../utils/theme';
import { getStudentData } from '../database/localDB';
import { setStudentData } from '../store/studentSlice';

/**
 * WHAT: Returns the Juz (1-30) containing a given surah/verse by linear-scanning JUZ_MAP
 *       (first entry whose (s,v) >= target wins).
 * FLOW: 1) juz starts at 1; 2) loop JUZ_MAP entries ({j,s,v}), keeping the last entry where
 *       entry.s < surahId, or (entry.s === surahId && entry.v <= verseNum); 3) return juz.
 * CALLS: none (reads JUZ_MAP, src/utils/theme.ts).
 * CALLED BY: renderBookmark (juz badge) and the pinned LAST READ card.
 * AFFECTS: UI only.
 * NOTES: O(30) scan per row — fine for list sizes. Duplicated logic exists as
 *        getStartJuzOfSurah (src/utils/theme.ts) but that one only checks surah, not verse.
 */
const getJuzForVerse = (surahId: number, verseNum: number): number => {
  let juz = 1;
  for (const entry of JUZ_MAP) {
    if (entry.s < surahId || (entry.s === surahId && entry.v <= verseNum)) {
      juz = entry.j;
    }
  }
  return juz;
};

/**
 * WHAT: Formats an ISO timestamp as "Mon D, YYYY  h:mm AM/PM"; returns '' for falsy input.
 * FLOW: Parse Date, build month/day/year, 12-hour clock with padded minutes + AM/PM.
 * CALLS: none.
 * CALLED BY: renderBookmark (card timestamp).
 * AFFECTS: UI only.
 * NOTES: Duplicated verbatim in MistakesScreen.tsx — shared util candidate.
 */
const formatDateTime = (ts: string): string => {
  if (!ts) return '';
  const d = new Date(ts);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const month = months[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();
  const hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 || 12;
  return `${month} ${day}, ${year}  ${h12}:${minutes} ${ampm}`;
};

/**
 * WHAT: Screen component: derives the sorted bookmark list + last read from Redux, renders
 *       empty state, pinned card, or FlatList of bookmark cards.
 * FLOW: 1) useSelector s.student.studentData and s.quran.surahNames; 2) sortedBookmarks
 *          useMemo: Object.values(studentData.bookmarks) sorted desc by createdAt (sort()
 *          MUTATES the values array in place — safe, the array is freshly built by Object.values);
 *          3) lastRead = studentData?.lastRead; 4) renderBookmark: computes juz + surah name,
 *          onPress -> handleNavigate(item.surah, item.verse); 5) renders pinned "LAST READ" card
 *          if lastRead exists, else empty state or FlatList.
 * CALLS: handleNavigate -> navigation.navigate('QuranView', { surahId, scrollToVerse }) — THE
 *        deep-link contract (QuranViewScreen consumes exactly these params, QuranViewScreen.tsx:363);
 *        focusRefresh -> getStudentData + setStudentData; getJuzForVerse / formatDateTime.
 * CALLED BY: React Navigation (registered in the root stack; opened via QuranViewScreen.tsx
 *            toolbar onBookmarks).
 * AFFECTS: Redux: s.student.studentData (focus re-hydration only). Navigation: pushes QuranView
 *          with {surahId, scrollToVerse}.
 * NOTES: keyExtractor is `${surah}_${verse}` — unique because the bookmarks map is keyed
 *        `surah_verse`; index keys would be silently REUSED across different rows after a
 *        bookmark deletion shifts/re-sorts the array. The focus re-hydration waits 700ms after
 *        focus so QuranViewScreen's 400ms updateData debounce has landed — reading SQLite any
 *        earlier could clobber Redux's optimistic state with an older flush. Without it, cloud
 *        pulls (api/sync.ts writes SQLite without touching Redux) never show up and a null
 *        studentData (QuranView not yet mounted this session) renders an unrecoverable empty
 *        state. The empty-state hint "Long-press a verse to bookmark it" refers to
 *        QuranViewScreen's handleBookmarkFlow, not to any action in this screen.
 */
export default function BookmarksScreen() {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const currentStudent = useSelector((s: any) => s.student.currentStudent);
  const studentData = useSelector((s: any) => s.student.studentData);
  const surahNames = useSelector((s: any) => s.quran.surahNames);

  /**
   * WHAT: Re-hydrates studentData from SQLite when the screen gains focus.
   * FLOW: On focus: wait 700ms (covers QuranViewScreen's 400ms updateData debounce), then
   *       getStudentData(currentStudent.id) -> dispatch(setStudentData). Skipped when no
   *       student is selected; timer cancelled on blur.
   * CALLS: getStudentData (localDB.ts), setStudentData (studentSlice).
   * CALLED BY: React Navigation focus events (useFocusEffect).
   * AFFECTS: s.student.studentData — replaced with the fresh SQLite snapshot.
   * NOTES: The only path that brings SQLite-only changes (canvas chunks, cloud pulls) into
   *       this screen without leaving the session.
   */
  useFocusEffect(React.useCallback(() => {
    if (!currentStudent) return;
    const t = setTimeout(() => {
      getStudentData(currentStudent.id).then(d => { if (d) dispatch(setStudentData(d)); }).catch(() => {});
    }, 700);
    return () => clearTimeout(t);
  }, [currentStudent, dispatch]));

  const sortedBookmarks = React.useMemo(() => {
    const bookmarks = studentData?.bookmarks ? Object.values(studentData.bookmarks) : [];
    return bookmarks.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [studentData?.bookmarks]);
  const lastRead = studentData?.lastRead;

  const handleNavigate = (surah: number, verse: number) => navigation.navigate('QuranView' as any, { surahId: surah, scrollToVerse: verse } as any);

  const renderBookmark = ({ item }: any) => {
    const juz = getJuzForVerse(item.surah, item.verse);
    const name = surahNames?.[item.surah] || `Surah ${item.surah}`;
    return (
      <TouchableOpacity style={styles.card} onPress={() => handleNavigate(item.surah, item.verse)} activeOpacity={0.7}>
        <View style={styles.cardHeader}>
          <View style={styles.surahRow}>
            <Text style={styles.surahName}>{name}</Text>
            <Text style={styles.verseNum}>Ayat {item.verse}</Text>
          </View>
          <View style={styles.badgeRow}>
            <View style={styles.juzBadge}><Text style={styles.juzBadgeText}>Juz {juz}</Text></View>
            <Text style={styles.surahId}>S{item.surah}:V{item.verse}</Text>
          </View>
        </View>
        {item.createdAt && (
          <Text style={styles.timestamp}>{formatDateTime(item.createdAt)}</Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {lastRead && (
        <TouchableOpacity style={styles.pinnedCard} onPress={() => handleNavigate(lastRead.surah, lastRead.verse)} activeOpacity={0.7}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pinnedLabel}>LAST READ</Text>
            <Text style={styles.pinnedText}>{surahNames?.[lastRead.surah] || '...'}  ·  Ayat {lastRead.verse}  ·  Juz {getJuzForVerse(lastRead.surah, lastRead.verse)}</Text>
          </View>
        </TouchableOpacity>
      )}

      {sortedBookmarks.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No bookmarks yet</Text>
          <Text style={styles.emptySub}>Long-press a verse to bookmark it</Text>
        </View>
      ) : (
        <FlatList
          data={sortedBookmarks}
          keyExtractor={(i: any) => `${i.surah}_${i.verse}`}
          contentContainerStyle={styles.list}
          renderItem={renderBookmark}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', padding: 16 },
  list: { paddingBottom: 20 },
  pinnedCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0a2a3f', padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#00d4aa' },
  pinnedLabel: { color: '#00d4aa', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 3 },
  pinnedText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  card: { backgroundColor: '#1a1a2e', padding: 14, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#2a2a4a' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  surahRow: { flex: 1, marginRight: 8 },
  surahName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  verseNum: { color: '#aaa', fontSize: 12, marginTop: 2 },
  badgeRow: { alignItems: 'flex-end' },
  juzBadge: { backgroundColor: '#00d4aa', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  juzBadgeText: { color: '#000', fontSize: 10, fontWeight: '800' },
  surahId: { color: '#666', fontSize: 10, marginTop: 4 },
  timestamp: { color: '#555', fontSize: 11, marginTop: 8 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#888', fontSize: 16, fontWeight: '600' },
  emptySub: { color: '#555', fontSize: 12, marginTop: 4 },
});
