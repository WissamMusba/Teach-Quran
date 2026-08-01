import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';

export default function MistakesScreen() {
  const navigation = useNavigation<any>();
  const studentData = useSelector((s: any) => s.student.studentData);
  const surahNames = useSelector((s: any) => s.quran.surahNames);
  const sortedMistakes = React.useMemo(() => {
    const highlights = studentData?.highlights ? Object.entries(studentData.highlights) : [];
    const mistakes = highlights.flatMap(([verseKey, data]: any) => (data?.highlights || []).map((h: any) => ({ verseKey, color: h.color, createdAt: h.createdAt })));
    return mistakes.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [studentData?.highlights]);

  const handleNavigate = (vKey: string) => {
    const [s, v] = vKey.split('_').map(Number);
    navigation.navigate('QuranView' as any, { surahId: s, scrollToVerse: v } as any);
  };

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
