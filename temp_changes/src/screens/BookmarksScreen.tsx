import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { JUZ_MAP } from '../utils/theme';

const getJuzForVerse = (surahId: number, verseNum: number): number => {
  let juz = 1;
  for (const entry of JUZ_MAP) {
    if (entry.s < surahId || (entry.s === surahId && entry.v <= verseNum)) {
      juz = entry.j;
    }
  }
  return juz;
};

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

export default function BookmarksScreen() {
  const navigation = useNavigation<any>();
  const studentData = useSelector((s: any) => s.student.studentData);
  const surahNames = useSelector((s: any) => s.quran.surahNames);
  
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
          <Text style={styles.pinnedIcon}>📍</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.pinnedLabel}>LAST READ</Text>
            <Text style={styles.pinnedText}>{surahNames[lastRead.surah] || '...'}  ·  Ayat {lastRead.verse}  ·  Juz {getJuzForVerse(lastRead.surah, lastRead.verse)}</Text>
          </View>
        </TouchableOpacity>
      )}

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
  container: { flex: 1, backgroundColor: '#121212', padding: 16 },
  list: { paddingBottom: 20 },
  pinnedCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0a2a3f', padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#00d4aa' },
  pinnedIcon: { fontSize: 22, marginRight: 14 },
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
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#888', fontSize: 16, fontWeight: '600' },
  emptySub: { color: '#555', fontSize: 12, marginTop: 4 },
});
