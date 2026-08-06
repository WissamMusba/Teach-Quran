/**
 * FILE: src/screens/MistakesScreen.tsx
 * ROLE: Aggregates every highlighted word across the student's highlights into a flat "mistakes" list (newest first); tapping deep-links to the verse in QuranView.
 * DEPENDS ON: Redux s.student.studentData.highlights, shape { [verseKey "surah_verse"]: { highlights: [{wordIndex, color, createdAt}] } } (written by handleWordPress/handleWordFlow in QuranViewScreen.tsx:355-363); s.quran.surahNames. Redux-only: SQLite hydration happens in QuranViewScreen.tsx:292-297.
 * USED BY: QuranView toolbar `onMistakes` (QuranViewScreen.tsx:509).
 */
import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';

/**
 * WHAT: Screen component: flattens the highlights map into a sorted list of individual highlighted words and renders them as colored-dot rows.
 * FLOW: 1) useSelector studentData + surahNames. 2) sortedMistakes useMemo: Object.entries(highlights).flatMap each verseKey -> its data.highlights array mapped to {verseKey, color, createdAt}; sort desc by createdAt. 3) handleNavigate splits verseKey on '_' -> Number(s), Number(v); navigate('QuranView', { surahId: s, scrollToVerse: v }). 4) Empty state or FlatList: row shows color dot (highlight color), "Surat {name} · Ayat {v}", formatted date; onPress -> handleNavigate.
 * CALLS: handleNavigate -> navigation.navigate('QuranView', {surahId, scrollToVerse}); formatDateTime -> date label.
 * CALLED BY: React Navigation; opened via QuranViewScreen.tsx:509.
 * AFFECTS: Navigation only.
 * NOTES: One row PER HIGHLIGHTED WORD, not per verse — the same verse can appear multiple times if several words are highlighted (a deliberate aggregation choice; taps always scroll to the verse, never highlight the word). Highlights with no createdAt sort as Invalid Date -> they sort to the top (NaN comparisons). No distinction by color semantics (MISTAKE_COLOR from src/utils/constants.ts is just a color; no filtering here).
 */
export default function MistakesScreen() {
  const navigation = useNavigation<any>();
  const studentData = useSelector((s: any) => s.student.studentData);
  const surahNames = useSelector((s: any) => s.quran.surahNames);
  /**
   * WHAT: Builds the sorted mistakes list from the highlights map.
   * FLOW: 1) Object.entries(highlights).flatMap each verseKey -> its data.highlights array mapped to {verseKey, color, createdAt}. 2) Sort desc by createdAt.
   * CALLS: none.
   * CALLED BY: Component render.
   * AFFECTS: FlatList data; empty-state condition.
   * NOTES: Keyed on studentData?.highlights; re-runs when highlights change.
   */
  const sortedMistakes = React.useMemo(() => {
    const highlights = studentData?.highlights ? Object.entries(studentData.highlights) : [];
    const mistakes = highlights.flatMap(([verseKey, data]: any) => (data?.highlights || []).map((h: any) => ({ verseKey, color: h.color, createdAt: h.createdAt })));
    return mistakes.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
          <Text style={styles.emptyIcon}>✏️</Text>
          <Text style={styles.emptyText}>No mistakes highlighted yet</Text>
          <Text style={styles.emptySub}>Highlight a word while reading to mark it</Text>
        </View>
      ) : (
        <FlatList data={sortedMistakes} keyExtractor={(i: any, idx: number) => idx.toString()} contentContainerStyle={styles.list} renderItem={({ item }: any) => {
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
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#888', fontSize: 16, fontWeight: '600' },
  emptySub: { color: '#555', fontSize: 12, marginTop: 4 },
});
