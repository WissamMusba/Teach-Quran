import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';

export default function BookmarksScreen() {
  const navigation = useNavigation<any>();
  const studentData = useSelector((s: any) => s.student.studentData);
  const surahNames = useSelector((s: any) => s.quran.surahNames);
  const lastRead = useSelector((s: any) => s.quran);
  const bookmarks = studentData?.bookmarks ? Object.values(studentData.bookmarks) : [];

  const handleNavigate = (surah: number, verse: number) => navigation.navigate('QuranView' as any, { surahId: surah, scrollToVerse: verse } as any);

  const formatTime = (ts: string) => ts ? new Date(ts).toLocaleDateString() : '';

  return (
    <View style={styles.container}>
      {bookmarks.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 48, marginBottom: 10 }}>📌</Text>
          <Text style={styles.emptyText}>No bookmarks yet</Text>
        </View>
      ) : (
        <FlatList data={bookmarks} keyExtractor={(i: any, idx: number) => idx.toString()} renderItem={({ item }: any) => (
          <TouchableOpacity style={styles.card} onPress={() => handleNavigate(item.surah, item.verse)}>
            <Text style={styles.text}>Surat {surahNames[item.surah] || '...'} ({item.surah}:{item.verse})</Text>
            {item.createdAt && <Text style={styles.timestamp}>{formatTime(item.createdAt)}</Text>}
          </TouchableOpacity>
        )} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, padding: 15, backgroundColor: '#121212' }, card: { backgroundColor: '#1e1e1e', padding: 20, borderRadius: 8, marginBottom: 10 }, text: { color: '#fff', fontSize: 16 }, timestamp: { color: '#555', fontSize: 12, marginTop: 5 }, emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' }, emptyText: { color: '#888', fontSize: 16 } });