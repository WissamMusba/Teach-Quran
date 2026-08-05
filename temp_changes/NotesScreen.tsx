/**
 * FILE: src/screens/NotesScreen.tsx
 * ROLE: Lists the student's text + voice notes per verse; plays embedded audio notes via react-native-audio-recorder-player; deep-links to the verse in QuranView.
 * DEPENDS ON: Redux s.student.studentData.notes, shape { [verseKey]: "\n-separated string" } where a line starting with "audio:" is a voice-note path (the `audio:` prefix IS the format contract). Voice notes are recorded by VoiceNoteRecorder (src/components/audio/VoiceNoteRecorder.tsx) and appended in QuranViewScreen.tsx:405-409 as `existing + '\n' + 'audio:' + path`; text notes come from the note modal (QuranViewScreen.tsx:397-401). Also s.quran.surahNames; react-native-audio-recorder-player for playback.
 * USED BY: QuranView toolbar `onNotes` (QuranViewScreen.tsx:510).
 */
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import { playAudioNote } from '../api/audioNotes';

/**
 * WHAT: One shared AudioRecorderPlayer instance for the whole screen; ensures only one clip plays at a time.
 * AFFECTS: Native audio session.
 * NOTES: Also created separately in QuranViewScreen (QuranViewScreen.tsx:31) — two independent players exist app-wide.
 */
const audioPlayer = new AudioRecorderPlayer();

/**
 * WHAT: Screen component: filters empty notes, renders cards with text lines and play buttons for audio lines.
 * FLOW: 1) useSelector studentData + surahNames. 2) notes useMemo: Object.entries(studentData.notes).filter(([k, v]) => v) — drops falsy/empty notes. 3) renderItem: parse verseKey, parseParts(item[1]); card header "Surat {name} · Ayat {v}", then per part: <Text> for text, <TouchableOpacity> play row for audio; card onPress -> handleNavigate.
 * CALLS: parseParts, togglePlay, handleNavigate.
 * CALLED BY: React Navigation; via QuranViewScreen.tsx:510.
 * AFFECTS: Navigation + audio session.
 * NOTES: keyExtractor = item[0] (verseKey) — unique per note. Empty-string notes (created then cleared) are filtered out at render, but the key remains in studentData.notes and will still be synced/persisted.
 */
export default function NotesScreen() {
  const navigation = useNavigation<any>();
  const studentData = useSelector((s: any) => s.student.studentData);
  const surahNames = useSelector((s: any) => s.quran.surahNames);
  /**
   * WHAT: Filters out falsy/empty notes from the notes map.
   * FLOW: Object.entries(studentData.notes).filter(([k, v]) => v).
   * CALLS: none.
   * CALLED BY: Component render.
   * AFFECTS: FlatList data; empty-state condition.
   * NOTES: Keeps array of [verseKey, rawValue] tuples, keyed by verseKey.
   */
  const notes = React.useMemo(() => {
    return studentData?.notes ? Object.entries(studentData.notes).filter(([k, v]) => v) : [];
  }, [studentData?.notes]);
  const [playingKey, setPlayingKey] = useState<string | null>(null);

  /**
   * WHAT: Stops playback + removes the playback listener when the screen unmounts.
   * FLOW: Return teardown fn: try stopPlayer() + removePlayBackListener(), swallow errors.
   * CALLS: audioPlayer.stopPlayer / audioPlayer.removePlayBackListener.
   * CALLED BY: React unmount lifecycle.
   * AFFECTS: Audio session.
   * NOTES: Cleanup is run once on unmount only (empty deps) — switching verses does NOT stop audio.
   */
  useEffect(() => () => { try { audioPlayer.stopPlayer(); audioPlayer.removePlayBackListener(); } catch {} }, []);

  /**
   * WHAT: Splits a note's raw string into ordered parts, tagging each line as text or audio.
   * FLOW: 1) Split value on '\n'. 2) Line starting with 'audio:' -> {type:'audio', content: line.slice(6)} (drops the prefix, keeps the path). 3) Non-empty other lines -> {type:'text', content: line}.
   * CALLS: none.
   * CALLED BY: renderItem (NotesScreen.tsx:72).
   * AFFECTS: none (pure).
   * NOTES: `audio:` detection is purely prefix-based on whole lines; a text line containing "audio:..." mid-sentence is safe because split is per-line.
   */
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

  /**
   * WHAT: Toggles voice-note playback: stops the currently playing clip, starts the tapped one, tracks it in playingKey.
   * FLOW: 1) If playingKey === audioKey -> stop + remove listener + clear playingKey (pause). 2) Else: stop any existing clip; startPlayer(path). 3) addPlayBackListener: when e.currentPosition >= e.duration - 100 (ms) -> stopPlayer, removePlayBackListener, clear playingKey. 4) setPlayingKey(audioKey); on error -> Alert.alert('Playback error', message).
   * CALLS: audioPlayer.stopPlayer / startPlayer(path) / addPlayBackListener / removePlayBackListener (react-native-audio-recorder-player).
   * CALLED BY: audio row onPress (NotesScreen.tsx:80), with audioKey = `${verseKey}_${partIndex}`.
   * AFFECTS: Audio session + component state playingKey.
   * NOTES: playingKey is a compound key `${item[0]}_${pi}` (verseKey + part index) so multiple audio parts in one note each have a distinct play button; the PLAY/PAUSE glyph + "Playing..."/"Voice note" label derive from it. End-of-playback check uses `duration - 100` ms tolerance — a clip shorter than ~200ms may never trigger the "done" path. No position state kept; restarting always plays from the start.
   */
  const togglePlay = async (audioKey: string, path: string) => {
    if (playingKey === audioKey) {
      try { await audioPlayer.stopPlayer(); } catch {}
      try { audioPlayer.removePlayBackListener(); } catch {}
      setPlayingKey(null);
      return;
    }
    try {
      if (playingKey) await audioPlayer.stopPlayer();
      // the tapped value is a Firebase Storage fileId, NOT a local path — resolve
      // it through the on-demand cache downloader (download happens ONLY on press)
      const local = await playAudioNote(path);
      if (!local) { Alert.alert('Playback error', 'Could not download voice note.'); return; }
      await audioPlayer.startPlayer(local);
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

  /**
   * WHAT: Converts a verseKey "surah_verse" into a QuranView deep-link.
   * FLOW: split('_').map(Number) -> navigate('QuranView', { surahId: s, scrollToVerse: v }).
   * CALLS: navigation.navigate (line 58).
   * CALLED BY: card onPress (NotesScreen.tsx:74).
   * AFFECTS: Navigation.
   * NOTES: The deep-link only SCROLLS to the verse — it does NOT auto-open the note modal (no note/verseKey param; QuranViewScreen.tsx:218-243 only reads surahId + scrollToVerse). User must long-press the verse again to see the note.
   */
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
