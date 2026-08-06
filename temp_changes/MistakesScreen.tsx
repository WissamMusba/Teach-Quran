/**
 * FILE: src/screens/MistakesScreen.tsx
 * ROLE: Aggregates every highlighted word across the student's highlights into a flat "mistakes" list (newest first); tapping deep-links to the verse in QuranView.
 * DEPENDS ON: Redux s.student.studentData.highlights, shape { [verseKey "surah_verse"]: { highlights: [{id, wordIndex, color, createdAt}] } }. WARNING: highlights are NOT written through Redux — handleWordFlow (QuranViewScreen.tsx:692-706) writes canvas chunks via saveCanvasEdit (page_N/surah_N in student_data_cache); studentData.highlights only exists because getStudentData (src/database/localDB.ts:193-211) merges every chunk's highlights at hydration. This screen therefore re-hydrates itself on focus through the same getStudentData — otherwise freshly marked mistakes NEVER appear (they only reach Redux via hydration). Also s.quran.surahNames. Redux-only hydration normally happens in QuranViewScreen.tsx:539-544.
 * USED BY: QuranView toolbar `onMistakes` (QuranViewScreen.tsx:1072).
 */
import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { getStudentData } from '../database/localDB';
import { setStudentData } from '../store/studentSlice';

/**
 * WHAT: Screen component: flattens the highlights map into a sorted list of individual highlighted words and renders them as colored-dot rows.
 * FLOW: 1) useSelector studentData + surahNames. 2) sortedMistakes useMemo: Object.entries(highlights).flatMap each verseKey -> its data.highlights array mapped to {verseKey, color, createdAt, id}; sort desc by createdAt. 3) handleNavigate splits verseKey on '_' -> Number(s), Number(v); navigate('QuranView', { surahId: s, scrollToVerse: v }). 4) Empty state or FlatList: row shows color dot (highlight color), "Surat {name} · Ayat {v}", formatted date; onPress -> handleNavigate.
 * CALLS: handleNavigate -> navigation.navigate('QuranView', {surahId, scrollToVerse}); formatDateTime -> date label; focusRefresh -> getStudentData + setStudentData.
 * CALLED BY: React Navigation; opened via QuranViewScreen.tsx:1072.
 * AFFECTS: Navigation only (+ Redux s.student.studentData on focus re-hydration).
 * NOTES: One row PER HIGHLIGHTED WORD, not per verse — the same verse can appear multiple times if several words are highlighted (a deliberate aggregation choice; taps always scroll to the verse, never highlight the word). Rows are keyed by h.id (fallback: list index) so deleting one highlight (toggle in QuranView) never reuses a key across rows. Missing/invalid createdAt coalesces to 0 in the sort -> rows without timestamps sink to the bottom deterministically (previous NaN comparisons left order undefined). No distinction by color semantics (MISTAKE_COLOR from src/utils/constants.ts is the only color the app writes today; no filtering here).
 */
export default function MistakesScreen() {
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
   * NOTES: THE critical refresh path: highlights are chunk-written (handleWordFlow ->
   *       saveCanvasEdit) and never dispatched through Redux, so without this effect a
   *       mistake marked seconds ago is invisible here until the app restarts or the
   *       student is re-selected. Also brings in cloud-pulled chunks (api/sync.ts writes
   *       SQLite without touching Redux).
   */
  useFocusEffect(React.useCallback(() => {
    if (!currentStudent) return;
    const t = setTimeout(() => {
      getStudentData(currentStudent.id).then(d => { if (d) dispatch(setStudentData(d)); }).catch(() => {});
    }, 700);
    return () => clearTimeout(t);
  }, [currentStudent, dispatch]));

  /**
   * WHAT: Builds the sorted mistakes list from the highlights map.
   * FLOW: 1) Object.entries(highlights).flatMap each verseKey -> its data.highlights array mapped to {verseKey, color, createdAt, id}. 2) Sort desc by createdAt, coalescing missing/invalid timestamps to 0 (they sink to the bottom).
   * CALLS: none.
   * CALLED BY: Component render.
   * AFFECTS: FlatList data; empty-state condition.
   * NOTES: Keyed on studentData?.highlights; re-runs when highlights change (including the
   *       focus re-hydration dispatch above). Keeps h.id so the FlatList can use a stable key.
   */
  const sortedMistakes = React.useMemo(() => {
    const highlights = studentData?.highlights ? Object.entries(studentData.highlights) : [];
    const mistakes = highlights.flatMap(([verseKey, data]: any) => (data?.highlights || []).map((h: any) => ({ verseKey, color: h.color, createdAt: h.createdAt, id: h.id })));
    return mistakes.sort((a: any, b: any) => (new Date(b.createdAt).getTime() || 0) - (new Date(a.createdAt).getTime() || 0));
  }, [studentData?.highlights]);

  /**
   * WHAT: Deep-links to the verse containing the tapped mistake.
   * FLOW: split verseKey on '_' -> Number(s), Number(v); navigation.navigate('QuranView', { surahId: s, scrollToVerse: v }).
   * CALLS: navigation.navigate (line 18).
   * CALLED BY: Card onPress in FlatList renderItem (line 40).
   * AFFECTS: Navigation.
   * NOTES: Scrolling only — no word/verse param to re-highlight the word in QuranView.
   */
  const handleNavigate = (vKey: string) => {
    const [s, v] = vKey.split('_').map(Number);
    navigation.navigate('QuranView' as any, { surahId: s, scrollToVerse: v } as any);
  };

  /**
   * WHAT: Formats a highlight timestamp as "Mon D, YYYY".
   * FLOW: new Date(ts); pick month short name from local array.
   * CALLS: none.
   * CALLED BY: renderItem timestamp Text (line 44).
   * AFFECTS: none (pure).
   * NOTES: Returns '' for missing ts (row renders without timestamp).
   */
  const formatDateTime = (ts: string): string => {
    if (!ts) return '';
    const d = new Date(ts);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  };

  return (
    <View style={styles.container}>
      {sortedMistakes.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No mistakes highlighted yet</Text>
          <Text style={styles.emptySub}>Highlight a word while reading to mark it</Text>
        </View>
      ) : (
        <FlatList data={sortedMistakes} keyExtractor={(i: any, idx: number) => i.id || idx.toString()} contentContainerStyle={styles.list} renderItem={({ item }: any) => {
          const [s, v] = item.verseKey.split('_').map(Number);
          return (
            <TouchableOpacity style={styles.card} onPress={() => handleNavigate(item.verseKey)} activeOpacity={0.7}>
              <View style={[styles.colorDot, { backgroundColor: item.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.surahText}>Surat {surahNames[s] || '...'}  ·  Ayat {v}</Text>
                {item.createdAt && <Text style={styles.timestamp}>{formatDateTime(item.createdAt)}</Text>}
              </View>
            </TouchableOpacity>
          );
        }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#121212' },
  list: { paddingBottom: 20 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a2e', padding: 14, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#2a2a4a' },
  colorDot: { width: 16, height: 16, borderRadius: 8, marginRight: 12 },
  surahText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  timestamp: { color: '#555', fontSize: 11, marginTop: 3 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#888', fontSize: 16, fontWeight: '600' },
  emptySub: { color: '#555', fontSize: 12, marginTop: 4 },
});
