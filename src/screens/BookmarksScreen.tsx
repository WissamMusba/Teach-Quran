import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';

export default function BookmarksScreen() {
  const navigation = useNavigation<any>();
  const studentData = useSelector((s: any) => s.student.studentData);
  const surahNames = useSelector((s: any) => s.quran.surahNames);
  
  const bookmarks = studentData?.bookmarks ? Object.values(studentData.bookmarks) : [];
  const sortedBookmarks = bookmarks.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  const lastRead = studentData?.lastRead;

  const handleNavigate = (surah: number, verse: number) => navigation.navigate('QuranView' as any, { surahId: surah, scrollToVerse: verse } as any);
  const formatTime = (ts: string) => ts ? new Date(ts).toLocaleDateString() : '';

  return (
    <View style={styles.container}>
      {lastRead && (
        <TouchableOpacity style={styles.pinnedCard} onPress={() => handleNavigate(lastRead.surah, lastRead.verse)}>
          <Text style={styles.pinnedIcon}>📍</Text>
          <View>
            <Text style={styles.pinnedTitle}>Last Read</Text>
            <Text style={styles.pinnedText}>Surat {surahNames[lastRead.surah] || '...'} ({lastRead.surah}:{lastRead.verse})</Text>
          </View>
        </TouchableOpacity>
      )}

      {sortedBookmarks.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 48, marginBottom: 10 }}>📌</Text>
          <Text style={styles.emptyText}>No bookmarks yet</Text>
        </View>
      ) : (
        <FlatList 
          data={sortedBookmarks} 
          keyExtractor={(i: any, idx: number) => idx.toString()} 
          renderItem={({ item }: any) => (
            <TouchableOpacity style={styles.card} onPress={() => handleNavigate(item.surah, item.verse)}>
              <Text style={styles.text}>Surat {surahNames[item.surah] || '...'} ({item.surah}:{item.verse})</Text>
              {item.createdAt && <Text style={styles.timestamp}>{formatTime(item.createdAt)}</Text>}
            </TouchableOpacity>
          )} 
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({ 
  container: { flex: 1, padding: 15, backgroundColor: '#121212' }, 
  pinnedCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#003366', padding: 20, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#00d4aa' },
  pinnedIcon: { fontSize: 24, marginRight: 15 },
  pinnedTitle: { color: '#00d4aa', fontSize: 12, fontWeight: 'bold', marginBottom: 2, textTransform: 'uppercase' },
  pinnedText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  card: { backgroundColor: '#1e1e1e', padding: 20, borderRadius: 8, marginBottom: 10 }, 
  text: { color: '#fff', fontSize: 16 }, 
  timestamp: { color: '#555', fontSize: 12, marginTop: 5 }, 
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' }, 
  emptyText: { color: '#888', fontSize: 16 } 
});