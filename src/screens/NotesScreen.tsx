/**
 * FILE: src/screens/NotesScreen.tsx
 * ROLE: Lists the student's text + voice notes per verse; plays embedded audio notes via react-native-audio-recorder-player; deep-links to the verse in QuranView.
 * DEPENDS ON: Redux s.student.studentData.notes, shape { [verseKey]: "\n-separated string" } where a line starting with "audio:" is a voice-note path (the `audio:` prefix IS the format contract). Voice notes are recorded by VoiceNoteRecorder (src/components/audio/VoiceNoteRecorder.tsx) and appended in QuranViewScreen.tsx:405-409 as `existing + '\n' + 'audio:' + path`; text notes come from the note modal (QuranViewScreen.tsx:397-401). Also s.quran.surahNames; react-native-audio-recorder-player for playback.
 * USED BY: QuranView toolbar `onNotes` (QuranViewScreen.tsx:1316).
 * PERF: Opening this screen is hot — the reader head-link fires while the JS thread may be
 *       recovering from QuranView's own student-data hydration. To keep the first frame + every
 *       FlatList re-render cheap: the screen renders IMMEDIATELY from the cached Redux
 *       s.student.studentData.notes, and SQLite hydration is GATED by a cheap `sync_last_pull`
 *       watermark probe (hydrateNotes) instead of re-running the full getStudentData chunk read
 *       (JSON.parse of EVERY page row, strokes included) on every focus. That gate holds because
 *       every same-device edit already reached Redux optimistically via setStudentData dispatches
 *       (QuranViewScreen save/edit paths), so the ONLY source of DB-side changes Redux cannot
 *       know — a pull — always bumps sync_last_pull. ALL per-note derivation (verseKey split +
 *       part parsing) is hoisted into a single useMemo keyed on the raw notes map, so a re-render
 *       never re-parses note strings or re-splits verseKeys. Rows render through a module-level
 *       React.memo(NoteCard) with stable callbacks (useCallback), so playback-key toggles
 *       re-render only the small card subtree instead of reparsing every note entry.
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ListRenderItem, Modal, TextInput, Pressable } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import { playAudioNote } from '../api/audioNotes';
import { getStudentData, getLastPullAt, saveCanvasEdit, canvasKeyForPage, canvasKeyForSurah } from '../database/localDB';
import { getVersePage } from '../database/quranData';
import { setStudentData } from '../store/studentSlice';
import { addPendingChange } from '../store/syncSlice';
import ScreenHeader from '../components/common/ScreenHeader';
import AlertModal from '../components/common/AlertModal';
import CollapsibleBannerAd from '../components/ads/CollapsibleBannerAd';

/**
 * WHAT: One shared AudioRecorderPlayer instance for the whole screen; ensures only one clip plays at a time.
 * AFFECTS: Native audio session.
 * NOTES: Also created separately in QoScreen (QuranViewScreen.tsx:31) — two independent players exist app-wide.
 */
const audioPlayer = new AudioRecorderPlayer();

/**
 * WHAT: Cross-open hydration signature `${currentStudentId}:${sync_last_pull}`
 *   guarded by hydrateNotes below. Stored at MODULE scope so it survives the
 *   screen's mount/unmount cycle — every open of a native-stack pushed screen is
 *   a fresh component mount, and a component-local ref would forget the previous
 *   hydration and force the full getStudentData read on every single open.
 * WHY: Redux ALREADY holds fresh notes on every open: notes are dispatched
 *   optimistically by every writer in the app (QuranViewScreen saveNote/updateData).
 *   The only writes that bypass Redux are pulls, and every pull bump commits
 *   sync_last_pull in the SAME transaction as the pulled rows (savePullBatch) —
 *   so a changed signature ⇔ the DB can actually differ from Redux.
 * NOTES: null = never hydrated this JS session (first open / after app restart /
 *   after switching students, since the sig embeds the student id).
 */
let notesHydratedSig: string | null = null;

/**
 * WHAT: Structural type of one parsed note entry — everything renderItem needs is
 *   packed here ONCE by the rows useMemo, so the FlatList render path does no
 *   string splitting or part-line classification.
 * NOTES: verseKey is the FlatList key; surah/ayah come from splitting it ONCE;
 *   parts is the pre-parsed line list (text vs audio) from parseParts.
 */
type NotePart = { type: 'text' | 'audio'; content: string };
type NoteRow = { verseKey: string; surah: number; ayah: number; parts: NotePart[] };

/**
 * WHAT: Splits a note's raw string into ordered parts, tagging each line as text or audio.
 * FLOW: 1) Split value on '\n'. 2) Line starting with 'audio:' -> {type:'audio', content: line.slice(6)} (drops the prefix, keeps the path). 3) Non-empty other lines -> {type:'text', content: line}.
 * CALLS: none.
 * CALLED BY: rows useMemo (NotesScreen.tsx) — once per data change, never per render.
 * AFFECTS: none (pure).
 * NOTES: `audio:` detection is purely prefix-based on whole lines; a text line containing "audio:..." mid-sentence is safe because split is per-line. Module-level so it is referentially stable across renders.
 */
const parseParts = (value: string): NotePart[] => {
  const parts: NotePart[] = [];
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
 * WHAT: One note card. Memoized so a FlatList scroll or a parent re-render does not
 *   re-render a row unless its own props changed; only the row that is actually
 *   playing (or just stopped) sees a different `playingKey`, so playback toggles
 *   touch at most two cards.
 * FLOW: Renders header "SURAH {s} · AYAH {v}" + surah name + accent line, then per part:
 *   <Text> for text, <TouchableOpacity> play row for audio. Card onPress -> onOpen(verseKey);
 *   audio row onPress -> onToggleAudio(path, `${row.verseKey}_${pi}`).
 * CALLS: none (pure render); onOpen / onToggleAudio callbacks come from NotesScreen.
 * CALLED BY: FlatList renderItem (NotesScreen.tsx).
 * AFFECTS: none (renders only).
 * NOTES: The `⏸`/`▶` glyph and 'Playing...'/'Voice note' label derive from playingKey ===
 *   `${row.verseKey}_${pi}` — one play button per audio line in the note.
 */
const NoteCard = React.memo((props: { row: NoteRow; surahName: string; nightMode: boolean; playingKey: string | null; onOpen: (verseKey: string) => void; onToggleAudio: (path: string, audioKey: string) => void; onLongPress: (verseKey: string) => void }) => {
  const { row, surahName, nightMode, playingKey, onOpen, onToggleAudio, onLongPress } = props;
  return (
    <TouchableOpacity style={[styles(nightMode).card, nightMode ? styles(nightMode).cardDark : styles(nightMode).cardLight]} onPress={() => onOpen(row.verseKey)} onLongPress={() => onLongPress(row.verseKey)} delayLongPress={350} activeOpacity={0.7}>
      <View style={styles(nightMode).cardHeader}>
        <Text style={styles(nightMode).surahLabel}>SURAH {row.surah} · AYAH {row.ayah}</Text>
        <Text style={[styles(nightMode).surahName, { color: nightMode ? '#fff' : '#1a1a1a' }]} numberOfLines={1}>{surahName || '...'}</Text>
        <View style={styles(nightMode).accentLine} />
      </View>
      {row.parts.map((part, pi) => {
        const audioKey = `${row.verseKey}_${pi}`;
        return part.type === 'text' ? (
          <Text key={pi} style={[styles(nightMode).noteText, { color: nightMode ? '#e8e8e8' : '#333' }]}>{part.content}</Text>
        ) : (
          <TouchableOpacity key={pi} style={[styles(nightMode).audioRow, { backgroundColor: nightMode ? 'rgba(255,255,255,0.05)' : 'rgba(28,61,114,0.08)' }]} onPress={() => onToggleAudio(part.content, audioKey)}>
            <Text style={styles(nightMode).playBtn}>{playingKey === audioKey ? '⏸' : '▶'}</Text>
            <Text style={styles(nightMode).audioLabel}>{playingKey === audioKey ? 'Playing...' : 'Voice note'}</Text>
          </TouchableOpacity>
        );
      })}
    </TouchableOpacity>
  );
});

/**
 * WHAT: Screen component: filters empty notes, renders cards with text lines and play buttons for audio lines.
 * FLOW: 1) useSelector studentData + surahNames. 2) notes useMemo: Object.entries(studentData.notes).filter(([k, v]) => v) — drops falsy/empty notes. 3) rows useMemo: parse each note's verseKey (split('_').map(Number)) + parts (parseParts) ONCE per data change -> prebuilt NoteRow[]. 4) FlatList renderItem -> NoteCard (React.memo) with stable onOpen/onToggleAudio callbacks. 5) hydrateNotes() reloads studentData from SQLite ONLY when the sync_last_pull watermark (or the current student) changed since the last hydration of this module — re-opens skip the full-DB read since Redux already holds the optimistic same-device edits.
 * CALLS: hydrateNotes (getStudentData / getLastPullAt), parseParts (rows memo), togglePlay, handleNavigate.
 * CALLED BY: React Navigation; via QuranViewScreen.tsx:510.
 * AFFECTS: Navigation + audio session.
 * NOTES: keyExtractor = row.verseKey — unique per note. Empty-string notes (created then cleared) are filtered out at render, but the key remains in studentData.notes and will still be synced/persisted.
 */
export default function NotesScreen() {
  const dispatch = useDispatch();
  const navigation = useNavigation<any>();
  const currentStudentId = useSelector((s: any) => s.student.currentStudent?.id);
  const syncStatus = useSelector((s: any) => s.sync.status);
  const studentData = useSelector((s: any) => s.student.studentData);
  const surahNames = useSelector((s: any) => s.quran.surahNames);
  const nightMode = useSelector((s: any) => s.settings?.nightMode);

  /**
   * WHAT: SQLite -> Redux hydration, gated so the heavy getStudentData read (every
   *   student_data_cache row JSON.parse'd — strokes/highlights/notes per page) runs
   *   ONLY when the DB can actually outdate Redux: first open / student switch /
   *   after a discovered pull. Both checks are cheap: students compare in-memory,
   *   and the pull watermark is ONE 1-row SELECT (sync_last_pull) — the pulled-rows
   *   transaction writes it atomically, so a changed watermark ⇔ pulled data landed.
   * FLOW: 1) bail when no current student (hook parity) or syncStatus === 'syncing'
   *   (a mid-sync read could render PARTIAL data — the syncing->synced watcher
   *   below applies everything in one shot); 2) getLastPullAt(sid) -> signature
   *   `${sid}:${pulledAt}`; 3) skip when the signature is unchanged since the last
   *   hydration (re-opens of the same student with no pull do ZERO DB reads);
   *   4) else stamp the signature and dispatch getStudentData -> setStudentData.
   * CALLS: getLastPullAt / getStudentData (localDB.ts), dispatch(setStudentData).
   * CALLED BY: focus effect + sync-transition effect below.
   * AFFECTS: s.student.studentData; the new identity re-derives the notes/rows
   *   memos (cheap per-note parse) — NOT a whole-DB scan.
   * NOTES: Same-device edits never flush here: QuranViewScreen dispatches
   *   setStudentData optimistically on every note/voice-note save, so Redux is
   *   already fresh at focus time. Signature lives at module scope so repeated
   *   opens (fresh component mounts) share one hydration per session/student.
   */
  const hydrateNotes = useCallback(async () => {
    const sid = currentStudentId;
    if (!sid || syncStatus === 'syncing') return;
    let pulledAt = 0;
    try { pulledAt = await getLastPullAt(sid); } catch { /* best-effort: fall back to a full reload below */ }
    const sig = `${sid}:${pulledAt}`;
    if (notesHydratedSig === sig) return;
    notesHydratedSig = sig;
    getStudentData(sid)
      .then((d: any) => { if (d) dispatch(setStudentData(d)); })
      .catch(() => {});
  }, [currentStudentId, syncStatus, dispatch]);

  // Focus hydration: reload only when the DB watermark actually moved since the
  // last hydration (or never hydrated this session) — the common re-open skips it.
  useFocusEffect(useCallback(() => { hydrateNotes(); }, [hydrateNotes]));

  // Sync-completion watcher (mirrors useStudentDataRefresh): a pull that lands
  // WHILE this screen is focused bumps the watermark and is applied immediately.
  const prevSyncStatusRef = useRef(syncStatus);
  useEffect(() => {
    const prev = prevSyncStatusRef.current;
    prevSyncStatusRef.current = syncStatus;
    if (prev === 'syncing' && syncStatus !== 'syncing') hydrateNotes();
  }, [syncStatus, hydrateNotes]);
  /**
   * WHAT: Filters out falsy/empty notes from the notes map.
   * FLOW: Object.entries(studentData.notes).filter(([k, v]) => v).
   * CALLS: none.
   * CALLED BY: Component render.
   * AFFECTS: rows memo; empty-state condition.
   * NOTES: Keeps array of [verseKey, rawValue] tuples, keyed by verseKey. Runs only when the
   *   notes map identity changes (Redux hydration), never on every re-render.
   */
  const notes = useMemo(() => {
    return studentData?.notes ? (Object.entries(studentData.notes).filter(([k, v]) => v) as [string, string][]) : [];
  }, [studentData?.notes]);

  /**
   * WHAT: The expensive per-note work (verseKey split + line classification) hoisted out of the
   *   render path and run exactly once per notes-map change. renderItem/NoteCard then do zero
   *   parsing — playback-key toggles, scroll and parent re-renders stay O(1) per row.
   * FLOW: notes.map: split verseKey -> surah/ayah, parseParts(value) -> parts.
   * CALLS: parseParts.
   * CALLED BY: Component render (memoized on [notes]).
   * AFFECTS: FlatList data + keyExtractor.
   * NOTES: surah numeric; surahNames[s] is looked up at render (name can change independently).
   */
  const rows: NoteRow[] = useMemo(() => {
    return notes.map(([verseKey, value]) => {
      const [s, v] = verseKey.split('_').map(Number);
      return { verseKey, surah: s, ayah: v, parts: parseParts(value) };
    });
  }, [notes]);

  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [chooserVerseKey, setChooserVerseKey] = useState<string | null>(null);
  const [editVerseKey, setEditVerseKey] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

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
   * WHAT: Toggles voice-note playback: stops the currently playing clip, starts the tapped one, tracks it in playingKey.
   * FLOW: 1) If playingKey === audioKey -> stop + remove listener + clear playingKey (pause). 2) Else: stop any existing clip; play the path directly when it is a LOCAL-ONLY voice note (starts with '/' or 'file://'), otherwise resolve cloud fileIds via playAudioNote. 3) startPlayer(local). 4) addPlayBackListener: when e.currentPosition >= e.duration - 100 (ms) -> stopPlayer, removePlayBackListener, clear playingKey. 5) setPlayingKey(audioKey); on error -> Alert.alert('Playback error', message).
   * CALLS: audioPlayer.stopPlayer / startPlayer(path) / addPlayBackListener / removePlayBackListener (react-native-audio-recorder-player); playAudioNote (cloud fileIds only).
   * CALLED BY: audio row onPress (NotesScreen.tsx), with audioKey = `${verseKey}_${partIndex}`.
   * AFFECTS: Audio session + component state playingKey.
   * NOTES: playingKey is a compound key `${verseKey}_${partIndex}` so multiple audio parts in one note each have a distinct play button; the PLAY/PAUSE glyph + "Playing..."/"Voice note" label derive from it. End-of-playback check uses `duration - 100` ms tolerance — a clip shorter than ~200ms may never trigger the "done" path. No position state kept; restarting always plays from the start.
   */
  const togglePlay = useCallback(async (audioKey: string, path: string) => {
    if (playingKey === audioKey) {
      try { await audioPlayer.stopPlayer(); } catch {}
      try { audioPlayer.removePlayBackListener(); } catch {}
      setPlayingKey(null);
      return;
    }
    try {
      if (playingKey) await audioPlayer.stopPlayer();
      // LOCAL-ONLY voice notes (Spark plan): the value is an absolute local m4a
      // path (or file:// URI) — play it directly. Cloud fileIds (Blaze plan:
      // playAudioNote download) are still supported for older/pulled notes.
      const isLocalPath = path.startsWith('/') || path.startsWith('file://');
      const local = isLocalPath ? path.replace(/^file:\/\//, '') : await playAudioNote(path);
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
  }, [playingKey]);

  /**
   * WHAT: Converts a verseKey "surah_verse" into a QuranView deep-link.
   * FLOW: split('_').map(Number) -> navigate('QuranView', { surahId: s, scrollToVerse: v }).
   * CALLS: navigation.navigate (NotesScreen.tsx).
   * CALLED BY: NoteCard card onPress.
   * AFFECTS: Navigation.
   * NOTES: The deep-link only SCROLLS to the verse — it does NOT auto-open the note modal (no note/verseKey param; QuranViewScreen.tsx:218-243 only reads surahId + scrollToVerse). User must long-press the verse again to see the note. useCallback + useRef-stable so NoteCard props stay referentially stable.
   */
  const handleNavigate = useCallback((vKey: string) => {
    const [s, v] = vKey.split('_').map(Number);
    navigation.navigate('QuranView' as any, { surahId: s, scrollToVerse: v } as any);
  }, [navigation]);

  /**
   * WHAT: Stable bridge from NoteCard's (path, audioKey) signature to togglePlay's
   *   (audioKey, path) signature, so NoteCard props never change identity except when
   *   togglePlay itself rebuilds on playingKey.
   * AFFECTS: none (pure delegation).
   */
  const onToggleAudio = useCallback((path: string, audioKey: string) => {
    togglePlay(audioKey, path);
  }, [togglePlay]);

  /**
   * WHAT: Opens the edit/delete chooser for a long-pressed note card.
   * CALLED BY: NoteCard onLongPress.
   */
  const handleRowLongPress = useCallback((vKey: string) => {
    setChooserVerseKey(vKey);
  }, []);

  /**
   * WHAT: Writes editText for the edited verseKey into the notes map via the SAME
   *   optimistic update path the app's note editor uses (setStudentData with a
   *   new notes map), replacing the existing note value wholesale. Mirrors
   *   QuranViewScreen.saveNote: after the Redux write, persists the note to
   *   SQLite (saveCanvasEdit, keyed by the verse's mushaf page — or the surah
   *   fallback when the page cannot be resolved) and bumps the sync queue so
   *   other devices receive it.
   * CALLS: dispatch(setStudentData), getVersePage, saveCanvasEdit, addPendingChange.
   * CALLED BY: edit modal Save button.
   */
  const saveEditedNote = useCallback(() => {
    if (!editVerseKey || !currentStudentId) return;
    const vKey = editVerseKey;
    dispatch(setStudentData({ ...(studentData || {}), notes: { ...(studentData?.notes || {}), [vKey]: editText } }));
    setEditVerseKey(null);
    setEditText('');
    getVersePage(parseInt(vKey.split('_')[0], 10), parseInt(vKey.split('_')[1], 10)).catch(() => 0).then((page: number) => {
      const key = page > 0 ? canvasKeyForPage(page) : canvasKeyForSurah(parseInt(vKey.split('_')[0], 10));
      saveCanvasEdit(currentStudentId, key, 'notes', { [vKey]: editText });
      dispatch(addPendingChange());
    });
  }, [editVerseKey, editText, studentData, currentStudentId, dispatch]);

  /**
   * WHAT: Removes a note from the notes map entirely (no dedicated slice action —
   *   same removal shape as QuranViewScreen.handleVoiceNoteDelete: rebuild the map,
   *   drop the key, dispatch setStudentData). ALSO persists the removal to SQLite
   *   via saveCanvasEdit ('' marks the key gone for the next pull/restart) and
   *   bumps the sync queue — otherwise the note silently returns on restart.
   * CALLS: dispatch(setStudentData), getVersePage, saveCanvasEdit, addPendingChange.
   * CALLED BY: chooser Delete button.
   */
  const deleteNote = useCallback((vKey: string) => {
    const notes = { ...(studentData?.notes || {}) };
    delete notes[vKey];
    dispatch(setStudentData({ ...(studentData || {}), notes }));
    setChooserVerseKey(null);
    if (!currentStudentId) return;
    getVersePage(parseInt(vKey.split('_')[0], 10), parseInt(vKey.split('_')[1], 10)).catch(() => 0).then((page: number) => {
      const key = page > 0 ? canvasKeyForPage(page) : canvasKeyForSurah(parseInt(vKey.split('_')[0], 10));
      saveCanvasEdit(currentStudentId, key, 'notes', { [vKey]: '' });
      dispatch(addPendingChange());
    });
  }, [studentData, currentStudentId, dispatch]);

  const openEditFor = useCallback((vKey: string) => {
    setEditText(studentData?.notes?.[vKey] || '');
    setEditVerseKey(vKey);
  }, [studentData]);

  /**
   * WHAT: Renders a prebuilt NoteRow through the memoized NoteCard. Stably recreated only
   *   when the data/theme/playback actually changed, so scrolling rows are not recreated.
   */
  const renderItem: ListRenderItem<NoteRow> = useCallback(({ item }) => (
    <NoteCard
      row={item}
      surahName={surahNames[item.surah]}
      nightMode={nightMode}
      playingKey={playingKey}
      onOpen={handleNavigate}
      onToggleAudio={onToggleAudio}
      onLongPress={handleRowLongPress}
    />
  ), [surahNames, nightMode, playingKey, handleNavigate, onToggleAudio, handleRowLongPress]);

  return (
    <View style={[styles(nightMode).container, { backgroundColor: nightMode ? '#121212' : '#f5f5f5' }]}>
      <ScreenHeader title="Notes" subtitle={`${notes.length} notes`} />
      {notes.length === 0 ? (
        <View style={styles(nightMode).emptyState}>
          <Text style={styles(nightMode).emptyIcon}>📝</Text>
          <Text style={[styles(nightMode).emptyText, { color: nightMode ? '#888' : '#666' }]}>No notes yet</Text>
          <Text style={[styles(nightMode).emptySub, { color: nightMode ? '#555' : '#999' }]}>Long-press a verse to add a note</Text>
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={rows}
          keyExtractor={(i: NoteRow) => i.verseKey}
          contentContainerStyle={styles(nightMode).list}
          renderItem={renderItem}
        />
      )}
      <CollapsibleBannerAd />

      <AlertModal
        visible={chooserVerseKey !== null}
        title="Note options"
        message={chooserVerseKey ? `Surah ${chooserVerseKey.split('_')[0]} · Ayah ${chooserVerseKey.split('_')[1]}` : ''}
        nightMode={nightMode}
        onClose={() => setChooserVerseKey(null)}
        buttons={[
          { text: 'Edit', style: 'default', onPress: () => { if (chooserVerseKey) openEditFor(chooserVerseKey); } },
          { text: 'Delete', style: 'destructive', onPress: () => { if (chooserVerseKey) deleteNote(chooserVerseKey); } },
        ]}
      />

      <Modal visible={editVerseKey !== null} transparent animationType="fade" onRequestClose={() => setEditVerseKey(null)}>
        <Pressable style={styles(nightMode).noteOverlay} onPress={() => setEditVerseKey(null)}>
          <Pressable onPress={() => {}}>
            <View style={styles(nightMode).noteContainer}>
              <TextInput style={styles(nightMode).noteInput} value={editText} onChangeText={setEditText} multiline placeholder="Note..." placeholderTextColor="#666" />
              <View style={styles(nightMode).noteActions}>
                <TouchableOpacity onPress={() => setEditVerseKey(null)} style={styles(nightMode).noteCancelBtn}><Text style={{ color: '#fff' }}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity onPress={saveEditedNote} style={styles(nightMode).noteSaveBtn}><Text style={{ color: '#121212' }}>Save</Text></TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = (nightMode: boolean) => StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, paddingBottom: 20 },
  card: { padding: 16, borderRadius: 14, marginBottom: 12, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  cardDark: { backgroundColor: '#1a1a2e', borderColor: '#2a2a4a' },
  cardLight: { backgroundColor: '#ffffff', borderColor: '#e2e5f0' },
  cardHeader: { marginBottom: 6 },
  surahLabel: { color: (nightMode ? '#7BA7DB' : '#1C3D72'), fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 4 },
  surahName: { fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },
  accentLine: { height: 2, width: 34, backgroundColor: (nightMode ? '#7BA7DB' : '#1C3D72'), borderRadius: 1, marginTop: 8, marginBottom: 10 },
  noteText: { fontFamily: 'sans-serif', fontSize: 15, lineHeight: 22, marginBottom: 2 },
  audioRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, marginTop: 8 },
  playBtn: { fontSize: 14, marginRight: 8, color: (nightMode ? '#7BA7DB' : '#1C3D72') },
  audioLabel: { color: (nightMode ? '#7BA7DB' : '#1C3D72'), fontSize: 13, fontWeight: '700' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '600' },
  emptySub: { fontSize: 12, marginTop: 4 },
  noteOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)' },
  noteContainer: { width: '80%', backgroundColor: (nightMode ? '#1e1e1e' : '#fff'), borderRadius: 10, padding: 20, borderWidth: 1, borderColor: (nightMode ? '#2a2a2a' : '#ddd') },
  noteInput: { color: (nightMode ? '#fff' : '#121212'), borderWidth: 1, borderColor: '#333', borderRadius: 8, padding: 10, height: 100, textAlignVertical: 'top', marginBottom: 15 },
  noteActions: { flexDirection: 'row', justifyContent: 'space-between' },
  noteCancelBtn: { padding: 10, alignItems: 'center', backgroundColor: '#333', borderRadius: 8, flex: 1, marginRight: 5 },
  noteSaveBtn: { padding: 10, alignItems: 'center', backgroundColor: (nightMode ? '#7BA7DB' : '#1C3D72'), borderRadius: 8, flex: 1, marginLeft: 5 },
});