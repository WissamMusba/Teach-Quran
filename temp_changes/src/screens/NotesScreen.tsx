import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';

const audioPlayer = new AudioRecorderPlayer();

export default function NotesScreen() {
  const navigation = useNavigation<any>();
  const studentData = useSelector((s: any) => s.student.studentData);
  const surahNames = useSelector((s: any) => s.quran.surahNames);
  const notes = React.useMemo(() => {
    return studentData?.notes ? Object.entries(studentData.notes).filter(([k, v]) => v) : [];
  }, [studentData?.notes]);
  const [playingKey, setPlayingKey] = useState<string | null>(null);

  useEffect(() => () => { try { audioPlayer.stopPlayer(); audioPlayer.removePlayBackListener(); } catch {} }, []);

  const parseParts = (value: string) => {
    const parts: { type: 'text' | 'audio'; content: string }[] = [];
    const lines = value.split('\n');
    for (const line of lines) {
      if (line.startsWith('audio:')) {
        parts.push({ type: 'audio', content: line.slice(6) });
      } else if (line.trim()) {
        parts.push({ type: 'text', content: line });
      }
    }
    return parts;
  };

  const togglePlay = async (audioKey: string, path: string) => {
    if (playingKey === audioKey) {
      try { await audioPlayer.stopPlayer(); } catch {}
      try { audioPlayer.removePlayBackListener(); } catch {}
      setPlayingKey(null);
      return;
    }
    try {
      if (playingKey) await audioPlayer.stopPlayer();
      await audioPlayer.startPlayer(path);
      audioPlayer.addPlayBackListener((e: any) => {
        if (e.currentPosition >= e.duration - 100) {
          audioPlayer.stopPlayer();
          audioPlayer.removePlayBackListener();
          setPlayingKey(null);
        }
      });
      setPlayingKey(audioKey);
    } catch (e: any) {
      Alert.alert('Playback error', e?.message || 'Could not play audio.');
    }
  };

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
          const parts = parseParts(item[1]);
          return (
            <TouchableOpacity style={styles.card} onPress={() => handleNavigate(item[0])} activeOpacity={0.7}>
              <Text style={styles.surahText}>Surat {surahNames[s] || '...'}  ·  Ayat {v}</Text>
              {parts.map((part, pi) => (
                part.type === 'text' ? (
                  <Text key={pi} style={styles.noteText}>{part.content}</Text>
                ) : (
                  <TouchableOpacity key={pi} style={styles.audioRow} onPress={() => togglePlay(`${item[0]}_${pi}`, part.content)}>
                    <Text style={styles.playBtn}>{playingKey === `${item[0]}_${pi}` ? '⏸' : '▶'}</Text>
                    <Text style={styles.audioLabel}>{playingKey === `${item[0]}_${pi}` ? 'Playing...' : 'Voice note'}</Text>
                  </TouchableOpacity>
                )
              ))}
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
  noteText: { color: '#fff', fontSize: 14, lineHeight: 20, marginBottom: 2 },
  audioRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 4, backgroundColor: '#2a2a4a', borderRadius: 8, marginTop: 4 },
  playBtn: { fontSize: 18, marginRight: 8 },
  audioLabel: { color: '#00d4aa', fontSize: 13, fontWeight: '600' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#888', fontSize: 16, fontWeight: '600' },
  emptySub: { color: '#555', fontSize: 12, marginTop: 4 },
});
