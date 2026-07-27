import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';

export default function NotesScreen() {
  const navigation = useNavigation<any>();
  const studentData = useSelector((s: any) => s.student.studentData);
  const surahNames = useSelector((s: any) => s.quran.surahNames);
  const notes = studentData?.notes ? Object.entries(studentData.notes).filter(([k, v]) => !k.startsWith('audio:') && v) : [];

  const handleNavigate = (vKey: string) => {
    const [s, v] = vKey.split('_').map(Number);
    navigation.navigate('QuranView' as any, { surahId: s, scrollToVerse: v } as any);
  };

  return (
    <View style={styles.container}>
      {notes.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📝</Text>
          <Text style={styles.emptyText}>No notes yet</Text>
          <Text style={styles.emptySub}>Long-press a verse to add a note</Text>
        </View>
      ) : (
        <FlatList data={notes} keyExtractor={(i: any) => i[0]} contentContainerStyle={styles.list} renderItem={({ item }: any) => {
          const [s, v] = item[0].split('_').map(Number);
          return (
            <TouchableOpacity style={styles.card} onPress={() => handleNavigate(item[0])} activeOpacity={0.7}>
              <Text style={styles.surahText}>Surat {surahNames[s] || '...'}  ·  Ayat {v}</Text>
              <Text style={styles.noteText} numberOfLines={3}>{item[1]}</Text>
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
  card: { backgroundColor: '#1a1a2e', padding: 14, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#2a2a4a' },
  surahText: { color: '#00d4aa', fontSize: 12, fontWeight: '700', marginBottom: 6, letterSpacing: 0.5 },
  noteText: { color: '#fff', fontSize: 14, lineHeight: 20 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#888', fontSize: 16, fontWeight: '600' },
  emptySub: { color: '#555', fontSize: 12, marginTop: 4 },
});
