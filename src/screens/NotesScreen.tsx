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
          <Text style={{ fontSize: 48, marginBottom: 10 }}>📝</Text>
          <Text style={styles.emptyText}>No notes yet</Text>
        </View>
      ) : (
        <FlatList data={notes} keyExtractor={(i: any) => i[0]} renderItem={({ item }: any) => {
          const [s, v] = item[0].split('_').map(Number);
          return (
            <TouchableOpacity style={styles.card} onPress={() => handleNavigate(item[0])}>
              <Text style={styles.headerText}>Surat {surahNames[s] || '...'} ({s}:{v})</Text>
              <Text style={styles.noteText}>{item[1]}</Text>
            </TouchableOpacity>
          );
        }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15, backgroundColor: '#121212' },
  card: { backgroundColor: '#1e1e1e', padding: 20, borderRadius: 8, marginBottom: 10 },
  headerText: { color: '#0066FF', fontSize: 14, fontWeight: 'bold', marginBottom: 5 },
  noteText: { color: '#fff', fontSize: 16 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#888', fontSize: 16 }
});