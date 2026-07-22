import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';

export default function MistakesScreen() {
  const navigation = useNavigation();
  const studentData = useSelector((s: any) => s.student.studentData);
  const surahNames = useSelector((s: any) => s.quran.surahNames);
  const highlights = studentData?.highlights ? Object.entries(studentData.highlights) : [];
  const mistakes = highlights.flatMap(([verseKey, data]: any) => (data?.highlights || []).map((h: any) => ({ verseKey, color: h.color })));

  const handleNavigate = (vKey: string) => { 
    const [s, v] = vKey.split('_').map(Number); 
    navigation.navigate('QuranView' as never, { surahId: s, scrollToVerse: v } as never); 
  };

  return (
    <View style={styles.container}>
      {mistakes.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 48, marginBottom: 10 }}>✏️</Text>
          <Text style={styles.emptyText}>No mistakes highlighted yet</Text>
        </View>
      ) : (
        <FlatList data={mistakes} keyExtractor={(i: any, idx: number) => idx.toString()} renderItem={({ item }: any) => {
          const [s, v] = item.verseKey.split('_').map(Number);
          return (
            <TouchableOpacity style={styles.card} onPress={() => handleNavigate(item.verseKey)}>
              <View style={{ width: 20, height: 20, backgroundColor: item.color, borderRadius: 10, marginRight: 10 }} />
              <Text style={styles.text}>Surat {surahNames[s] || '...'} ({s}:{v})</Text>
            </TouchableOpacity>
          );
        }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, padding: 15, backgroundColor: '#121212' }, card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e1e1e', padding: 20, borderRadius: 8, marginBottom: 10 }, text: { color: '#fff', fontSize: 16 }, emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' }, emptyText: { color: '#888', fontSize: 16 } });