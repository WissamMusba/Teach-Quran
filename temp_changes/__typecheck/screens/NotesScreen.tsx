/**
 * FILE: src/screens/NotesScreen.tsx
 * ROLE: Lists the student's text + voice notes per verse; plays embedded audio notes via react-native-audio-recorder-player; deep-links to the verse in QuranView.
 * DEPENDS ON: SQLite chunk store (student_data_cache, `page_<n>` / `surah_<id>` rows) — the notes map { [verseKey]: "\n-separated string" } now lives in each chunk's `notes` section; a line starting with "audio:" is a voice-note fileId (the `audio:` prefix IS the format contract). Written by QuranViewScreen.tsx:770-779 (text, saveNote) and :788-813 (voice, handleVoiceNoteSaved -> uploadAudioNote -> `audio:<fileId>` append at :799). This screen re-aggregates the map from SQLite on every focus via getStudentData (src/database/localDB.ts) because Redux s.student.studentData.notes is only hydrated at QuranView mount (QuranViewScreen.tsx:539-544) and is NOT updated by note saves. Also s.quran.surahNames; react-native-audio-recorder-player for playback.
 * USED BY: QuranView toolbar `onNotes` (QuranViewScreen.tsx:1073) — route 'Notes' (App.tsx:115).
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useSelector } from 'react-redux';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import { playAudioNote } from '../api/audioNotes';
import { getStudentData } from '../database/localDB';

/**
 * WHAT: One shared AudioRecorderPlayer instance for the whole screen; ensures only one clip plays at a time.
 * AFFECTS: Native audio session.
 * NOTES: Also created separately in QuranViewScreen (QuranViewScreen.tsx:31) — two independent players exist app-wide.
 */
const audioPlayer = new AudioRecorderPlayer();

/**
 * WHAT: Screen component: filters empty notes, renders cards with text lines and play buttons for audio lines.
 * FLOW: 1) useSelector currentStudent + studentData + surahNames. 2) useFocusEffect: re-aggregate the notes map from SQLite (getStudentData) on every focus — Redux studentData.notes goes stale the moment a note is saved (QuranView writes only SQLite chunks). 3) notes useMemo: prefer SQLite-fresh dbNotes, fall back to studentData.notes while loading; then Object.entries().filter(([k, v]) => v) — drops falsy/empty notes. 4) renderItem: parse verseKey, parseParts(item[1]); card header "Surat {name} · Ayat {v}", then per part: <Text> for text, <TouchableOpacity> play row for audio; card onPress -> handleNavigate.
 * CALLS: getStudentData, parseParts, togglePlay, handleNavigate.
 * CALLED BY: React Navigation; via QuranViewScreen.tsx:1073.
 * AFFECTS: Navigation + audio session.
 * NOTES: keyExtractor = item[0] (verseKey) — unique per note. Empty-string notes (created then cleared) are filtered out at render, but the key remains in the chunk and will still be synced/persisted.
 */
export default function NotesScreen() {
  const navigation = useNavigation<any>();
  const currentStudent = useSelector((s: any) => s.student.currentStudent);
  const studentData = useSelector((s: any) => s.student.studentData);
  const surahNames = useSelector((s: any) => s.quran.surahNames);
  /**
   * WHAT: Refreshes the notes map from SQLite every time the screen gains focus.
   * FLOW: getStudentData(currentStudent.id) -> blob.notes (aggregates the `notes`
   *   sections of ALL page/surah chunks — the authoritative store). Results replace
   *   dbNotes only after the read lands (no loading flash); failures leave dbNotes
   *   untouched so Redux still backs the list.
   * CALLS: getStudentData (src/database/localDB.ts).
   * CALLED BY: React focus lifecycle.
   * AFFECTS: notes memo -> FlatList data.
   * NOTES: Needed because saveNote / handleVoiceNoteSaved in QuranViewScreen write
   *   straight to SQLite chunks without dispatching setStudentData, so Redux
   *   studentData.notes is stale from the moment the first note is edited this
   *   session — a focus-refresh is the only reliable way to pick new notes up.
   */
  const [dbNotes, setDbNotes] = useState<Record<string, string> | null>(null);
  useFocusEffect(useCallback(() => {
    let cancelled = false;
    const sid = currentStudent?.id;
    if (sid) {
      getStudentData(sid).then((blob: any) => {
        if (!cancelled) setDbNotes(blob?.notes || {});
      }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, [currentStudent?.id]));
  /**
   * WHAT: Filters out falsy/empty notes from the notes map.
   * FLOW: SQLite-fresh dbNotes if loaded, else Redux studentData.notes; then
   *   Object.entries().filter(([k, v]) => v).
   * CALLS: none.
   * CALLED BY: Component render.
   * AFFECTS: FlatList data; empty-state condition.
   * NOTES: Keeps array of [verseKey, rawValue] tuples, keyed by verseKey.
   */
  const notes = React.useMemo(() => {
    const src = dbNotes || studentData?.notes || {};
    return Object.entries(src).filter(([k, v]) => v);
  }, [dbNotes, studentData?.notes]);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const playTokenRef = useRef(0);

  /**
   * WHAT: Stops playback + removes the playback listener when the screen unmounts.
   * FLOW: Return teardown fn: stopPlayer() (rejection swallowed on the promise —
   *   the lib rejects when no player was ever started) + removePlayBackListener().
   * CALLS: audioPlayer.stopPlayer / audioPlayer.removePlayBackListener.
   * CALLED BY: React unmount lifecycle.
   * AFFECTS: Audio session.
   * NOTES: Cleanup is run once on unmount only (empty deps) — switching verses does
   *   NOT stop audio. A bare try/catch is NOT enough around stopPlayer(): the
   *   rejection arrives asynchronously, so it must be caught on the promise itself.
   */
  useEffect(() => () => { try { audioPlayer.stopPlayer().catch(() => {}); } catch {} audioPlayer.removePlayBackListener(); }, []);

  /**
   * WHAT: Splits a note's raw string into ordered parts, tagging each line as text or audio.
   * FLOW: 1) Split value on '\n'. 2) Line starting with 'audio:' -> {type:'audio', content: line.slice(6)} (drops the prefix, keeps the fileId). 3) Non-empty other lines -> {type:'text', content: line}.
   * CALLS: none.
   * CALLED BY: renderItem (NotesScreen.tsx:171).
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
   * FLOW: 1) token = ++playTokenRef (invalidates every in-flight press + its listener). 2) If playingKey === audioKey -> stop + remove listener + clear playingKey (pause). 3) Else: stop the existing clip AND remove its listener BEFORE adding a new one (else accumulated listeners tick in parallel and the old one's end-check stops the NEW clip). 4) startPlayer(local) where local = playAudioNote(fileId) — on-demand Firebase Storage download. 5) addPlayBackListener: only applies while the token is current; at e.currentPosition >= e.duration - 100 -> stopPlayer (rejection swallowed) + removePlayBackListener + clear playingKey. 6) setPlayingKey only if the token is still current; on error -> Alert.alert('Playback error', message).
   * CALLS: playAudioNote (../api/audioNotes.ts), audioPlayer.stopPlayer / startPlayer / addPlayBackListener / removePlayBackListener (react-native-audio-recorder-player).
   * CALLED BY: audio row onPress (NotesScreen.tsx:181), with audioKey = `${verseKey}_${partIndex}`.
   * AFFECTS: Audio session + component state playingKey.
   * NOTES: playingKey is a compound key `${item[0]}_${pi}` (verseKey + part index) so multiple audio parts in one note each have a distinct play button; the Play/Stop label derives from it. The token guards the download race: playingKey is only set AFTER startPlayer, so two quick taps both run the async download — the loser's listener and state update are discarded. End-of-playback check uses `duration - 100` ms tolerance — a clip shorter than ~200ms may never trigger the "done" path (the recorder enforces >500ms, so safe). No position state kept; restarting always plays from the start.
   */
  const togglePlay = async (audioKey: string, fileId: string) => {
    const token = ++playTokenRef.current;
    if (playingKey === audioKey) {
      try { await audioPlayer.stopPlayer(); } catch {}
      audioPlayer.removePlayBackListener();
      setPlayingKey(null);
      return;
    }
    try {
      if (playingKey) {
        await audioPlayer.stopPlayer();
        audioPlayer.removePlayBackListener();
      }
      // the tapped value is a Firebase Storage fileId, NOT a local path — resolve
      // it through the on-demand cache downloader (download happens ONLY on press)
      const local = await playAudioNote(fileId);
      if (!local) { Alert.alert('Playback error', 'Could not download voice note.'); return; }
      await audioPlayer.startPlayer(local);
      audioPlayer.addPlayBackListener((e: any) => {
        if (playTokenRef.current !== token) return;
        if (e.currentPosition >= e.duration - 100) {
          try { audioPlayer.stopPlayer().catch(() => {}); } catch {}
          audioPlayer.removePlayBackListener();
          setPlayingKey(null);
        }
      });
      if (playTokenRef.current === token) setPlayingKey(audioKey);
    } catch (e: any) {
      Alert.alert('Playback error', e?.message || 'Could not play audio.');
    }
  };

  /**
   * WHAT: Converts a verseKey "surah_verse" into a QuranView deep-link.
   * FLOW: split('_').map(Number) -> navigate('QuranView', { surahId: s, scrollToVerse: v }).
   * CALLS: navigation.navigate (line 160).
   * CALLED BY: card onPress (NotesScreen.tsx:175).
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
                    <Text style={styles.playBtn}>{playingKey === `${item[0]}_${pi}` ? 'Stop' : 'Play'}</Text>
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
  playBtn: { fontSize: 13, fontWeight: '700', color: '#fff', marginRight: 8 },
  audioLabel: { color: '#00d4aa', fontSize: 13, fontWeight: '600' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#888', fontSize: 16, fontWeight: '600' },
  emptySub: { color: '#555', fontSize: 12, marginTop: 4 },
});
