/**
 * FILE: src/screens/NotesScreen.tsx
 * ROLE: Lists the student's text + voice notes per verse with pure vector SVG icons and theme integration.
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ListRenderItem, Modal, TextInput, Pressable } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import RNFS from 'react-native-fs';
import { playAudioNote } from '../api/audioNotes';
import { getStudentData, getLastPullAt, saveCanvasEdit, canvasKeyForPage, canvasKeyForSurah, getVersePagesDB } from '../database/localDB';
import { getVersePage } from '../database/quranData';
import { setStudentData } from '../store/studentSlice';
import { addPendingChange } from '../store/syncSlice';
import ScreenHeader from '../components/common/ScreenHeader';
import AlertModal from '../components/common/AlertModal';
import CollapsibleBannerAd from '../components/ads/CollapsibleBannerAd';
import { getThemeColors } from '../utils/theme';

const audioPlayer = new AudioRecorderPlayer();
let notesHydratedSig: string | null = null;

const IconNotes = ({ c, size = 20 }: { c: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </Svg>
);

const IconPlay = ({ c, size = 14 }: { c: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={c} style={{ marginRight: 6 }}>
    <Path d="M8 5v14l11-7z" />
  </Svg>
);

const IconPause = ({ c, size = 14 }: { c: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={c} style={{ marginRight: 6 }}>
    <Path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </Svg>
);

interface NoteRow {
  verseKey: string;
  surah: number;
  ayah: number;
  parts: { type: 'text' | 'audio'; value: string }[];
}

const parseParts = (value: string): { type: 'text' | 'audio'; value: string }[] => {
  if (!value) return [];
  return value
    .split('\n')
    .filter((l) => l.trim())
    .map((line) => (line.startsWith('audio:') ? { type: 'audio' as const, value: line.replace('audio:', '') } : { type: 'text' as const, value: line }));
};

const NoteCard = React.memo(({
  row, surahName, page, nightMode, themeColors, playingKey, onOpen, onToggleAudio, onLongPress
}: {
  row: NoteRow;
  surahName?: string;
  page?: number;
  nightMode: boolean;
  themeColors: any;
  playingKey: string | null;
  onOpen: (s: number, v: number, p?: number) => void;
  onToggleAudio: (audioKey: string, path: string) => void;
  onLongPress: (vKey: string) => void;
}) => {
  const { verseKey, surah, ayah, parts } = row;
  return (
    <TouchableOpacity
      style={[
        styles(nightMode, themeColors).card,
        {
          backgroundColor: themeColors.cardBg,
          borderColor: themeColors.border,
        }
      ]}
      onPress={() => onOpen(surah, ayah, page)}
      onLongPress={() => onLongPress(verseKey)}
      activeOpacity={0.8}
    >
      <View style={styles(nightMode, themeColors).cardHeader}>
        <Text style={[styles(nightMode, themeColors).surahLabel, { color: themeColors.accent }]}>
          SURAH {surah} · AYAH {ayah}{page ? ` · PAGE ${page}` : ''}
        </Text>
        <Text style={[styles(nightMode, themeColors).surahName, { color: themeColors.text }]}>{surahName || `Surah ${surah}`}</Text>
        <View style={[styles(nightMode, themeColors).accentLine, { backgroundColor: themeColors.accent }]} />
      </View>
      {parts.map((p, idx) => {
        if (p.type === 'text') {
          return <Text key={idx} style={[styles(nightMode, themeColors).noteText, { color: themeColors.text }]}>{p.value}</Text>;
        }
        const audioKey = `${verseKey}_${idx}`;
        const isThisPlaying = playingKey === audioKey;
        return (
          <TouchableOpacity
            key={idx}
            style={[styles(nightMode, themeColors).audioRow, { backgroundColor: nightMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}
            onPress={() => onToggleAudio(audioKey, p.value)}
            activeOpacity={0.7}
          >
            {isThisPlaying ? <IconPause c={themeColors.accent} size={14} /> : <IconPlay c={themeColors.accent} size={14} />}
            <Text style={[styles(nightMode, themeColors).audioLabel, { color: themeColors.accent }]}>{isThisPlaying ? 'Playing voice note...' : 'Voice note'}</Text>
          </TouchableOpacity>
        );
      })}
    </TouchableOpacity>
  );
});

export default function NotesScreen({ onClose, navigation: navProp }: { onClose?: () => void; navigation?: any } = {}) {
  const navigation = navProp || useNavigation<any>();
  const dispatch = useDispatch();
  const studentData = useSelector((s: any) => s.student.studentData);
  const currentStudentId = useSelector((s: any) => s.student.currentStudent?.id);
  const surahNames = useSelector((s: any) => s.quran.surahNames);
  const textStyle = useSelector((s: any) => s.quran.textStyle);
  const nightMode = useSelector((s: any) => s.settings.nightMode);
  const colorTheme = useSelector((s: any) => s.settings?.colorTheme || 'classic');

  const themeColors = useMemo(() => getThemeColors(colorTheme, nightMode), [colorTheme, nightMode]);

  const prevStudentIdRef = useRef(currentStudentId);
  const retainedNotesRef = useRef<Record<string, string>>({});

  if (prevStudentIdRef.current !== currentStudentId) {
    prevStudentIdRef.current = currentStudentId;
    retainedNotesRef.current = {};
    notesHydratedSig = null;
  }

  if (studentData?.notes && Object.keys(studentData.notes).length > 0) {
    retainedNotesRef.current = studentData.notes;
  }

  const hydrateNotes = useCallback(async () => {
    if (!currentStudentId) return;
    try {
      const pullAt = await getLastPullAt(currentStudentId);
      const sig = `${currentStudentId}:${pullAt ?? '0'}`;
      if (notesHydratedSig === sig) return;
      const res = await getStudentData(currentStudentId);
      if (res && res.notes) {
        notesHydratedSig = sig;
        retainedNotesRef.current = res.notes;
        dispatch(setStudentData(res));
      }
    } catch {}
  }, [currentStudentId, dispatch]);

  useFocusEffect(useCallback(() => { hydrateNotes(); }, [hydrateNotes]));

  const effectiveNotes = (studentData?.notes && Object.keys(studentData.notes).length > 0)
    ? studentData.notes
    : retainedNotesRef.current;

  const notes = useMemo<[string, string][]>(() => {
    return effectiveNotes ? (Object.entries(effectiveNotes).filter(([k, v]) => v) as [string, string][]) : [];
  }, [effectiveNotes]);

  const [filteredRows, setFilteredRows] = useState<NoteRow[]>([]);
  const [isValidated, setIsValidated] = useState(false);

  useEffect(() => {
    let active = true;

    const filterValidNotes = async () => {
      if (notes.length === 0) {
        if (active) {
          setFilteredRows([]);
          setIsValidated(true);
        }
        return;
      }

      const parsedRows = notes.map(([verseKey, value]) => {
        const [s, v] = verseKey.split('_').map(Number);
        return { verseKey, surah: s, ayah: v, parts: parseParts(value) };
      });

      const nextRows: NoteRow[] = [];

      for (const r of parsedRows) {
        const validParts: { type: 'text' | 'audio'; value: string }[] = [];
        for (const part of r.parts) {
          if (part.type === 'text') {
            validParts.push(part);
          } else if (part.type === 'audio') {
            const localPath = await playAudioNote(part.value);
            if (localPath) {
              validParts.push({ type: 'audio', value: localPath });
            }
          }
        }
        // If a note row only had an unplayable audio note (and no text),
        // validParts will be empty and the entire note card is filtered out!
        if (validParts.length > 0) {
          nextRows.push({ ...r, parts: validParts });
        }
      }

      if (active) {
        setFilteredRows(nextRows);
        setIsValidated(true);
      }
    };

    filterValidNotes();

    return () => {
      active = false;
    };
  }, [notes]);

  const [pages, setPages] = useState<Record<string, number>>({});
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [chooserVerseKey, setChooserVerseKey] = useState<string | null>(null);
  const [editVerseKey, setEditVerseKey] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  useEffect(() => {
    let active = true;
    const entries: [number, number][] = filteredRows.map((r) => [r.surah, r.ayah]);
    if (entries.length === 0) return;

    getVersePagesDB(entries).then((res) => {
      if (active && res) {
        setPages((prev) => ({ ...prev, ...res }));
      }
    }).catch(() => {});

    // Script-aware / indopak fallback
    for (const r of filteredRows) {
      getVersePage(r.surah, r.ayah, textStyle).then((pg) => {
        if (active && pg > 0) setPages((prev) => (prev[r.verseKey] === pg ? prev : { ...prev, [r.verseKey]: pg }));
      }).catch(() => {});
    }

    return () => { active = false; };
  }, [filteredRows, textStyle]);

  useEffect(() => () => { try { audioPlayer.stopPlayer(); audioPlayer.removePlayBackListener(); } catch {} }, []);

  const togglePlay = useCallback(async (audioKey: string, path: string) => {
    if (playingKey === audioKey) {
      try { await audioPlayer.stopPlayer(); } catch {}
      try { audioPlayer.removePlayBackListener(); } catch {}
      setPlayingKey(null);
      return;
    }
    try {
      if (playingKey) {
        try { await audioPlayer.stopPlayer(); } catch {}
      }
      // Use the resolved local path directly without touching cloud
      const local = await playAudioNote(path);
      if (!local) {
        Alert.alert('Playback error', 'Could not locate or play voice note file.');
        return;
      }
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
      Alert.alert('Playback error', e?.message || 'Could not play voice note.');
      setPlayingKey(null);
    }
  }, [playingKey]);

  const handleNavigate = useCallback(async (surah: number, verse: number, page?: number) => {
    let targetPage = page || pages[`${surah}_${verse}`];
    if (!targetPage) {
      try {
        targetPage = await getVersePage(surah, verse, textStyle);
      } catch {
        targetPage = 1;
      }
    }
    navigation.navigate('QuranView' as any, {
      page: targetPage,
      surahId: surah,
      scrollToVerse: verse,
      t: Date.now(),
    } as any);
  }, [navigation, pages, textStyle]);

  const onToggleAudio = useCallback((audioKey: string, path: string) => {
    togglePlay(audioKey, path);
  }, [togglePlay]);

  const handleRowLongPress = useCallback((vKey: string) => {
    setChooserVerseKey(vKey);
  }, []);

  const saveEditedNote = useCallback(() => {
    if (!editVerseKey || !currentStudentId) return;
    const vKey = editVerseKey;
    const nextNotes = { ...(studentData?.notes || retainedNotesRef.current || {}), [vKey]: editText };
    retainedNotesRef.current = nextNotes;
    dispatch(setStudentData({ ...(studentData || {}), notes: nextNotes }));
    setEditVerseKey(null);
    setEditText('');
    getVersePage(parseInt(vKey.split('_')[0], 10), parseInt(vKey.split('_')[1], 10)).catch(() => 0).then((page: number) => {
      const key = page > 0 ? canvasKeyForPage(page) : canvasKeyForSurah(parseInt(vKey.split('_')[0], 10));
      saveCanvasEdit(currentStudentId, key, 'notes', { [vKey]: editText });
      dispatch(addPendingChange());
    });
  }, [editVerseKey, editText, studentData, currentStudentId, dispatch]);

  const deleteNote = useCallback((vKey: string) => {
    const nextNotes = { ...(studentData?.notes || retainedNotesRef.current || {}) };
    delete nextNotes[vKey];
    retainedNotesRef.current = nextNotes;
    dispatch(setStudentData({ ...(studentData || {}), notes: nextNotes }));
    setChooserVerseKey(null);
    if (!currentStudentId) return;
    getVersePage(parseInt(vKey.split('_')[0], 10), parseInt(vKey.split('_')[1], 10)).catch(() => 0).then((page: number) => {
      const key = page > 0 ? canvasKeyForPage(page) : canvasKeyForSurah(parseInt(vKey.split('_')[0], 10));
      saveCanvasEdit(currentStudentId, key, 'notes', { [vKey]: '' });
      dispatch(addPendingChange());
    });
  }, [studentData, currentStudentId, dispatch]);

  const openEditFor = useCallback((vKey: string) => {
    setEditText(studentData?.notes?.[vKey] || retainedNotesRef.current[vKey] || '');
    setEditVerseKey(vKey);
  }, [studentData]);

  const renderItem: ListRenderItem<NoteRow> = useCallback(({ item }) => (
    <NoteCard
      row={item}
      surahName={surahNames[item.surah]}
      page={pages[item.verseKey]}
      nightMode={nightMode}
      themeColors={themeColors}
      playingKey={playingKey}
      onOpen={handleNavigate}
      onToggleAudio={onToggleAudio}
      onLongPress={handleRowLongPress}
    />
  ), [surahNames, pages, nightMode, themeColors, playingKey, handleNavigate, onToggleAudio, handleRowLongPress]);

  return (
    <View style={[styles(nightMode, themeColors).container, { backgroundColor: themeColors.bg }]}>
      <ScreenHeader title="Notes" subtitle={`${filteredRows.length} notes`} onBack={onClose} />
      {notes.length === 0 || (isValidated && filteredRows.length === 0) ? (
        <View style={styles(nightMode, themeColors).emptyState}>
          <IconNotes c={themeColors.accent} size={44} />
          <Text style={[styles(nightMode, themeColors).emptyText, { color: themeColors.subText, marginTop: 12 }]}>No notes yet</Text>
          <Text style={[styles(nightMode, themeColors).emptySub, { color: themeColors.subText }]}>Long-press a verse to add a note</Text>
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={filteredRows}
          keyExtractor={(i: NoteRow) => i.verseKey}
          contentContainerStyle={styles(nightMode, themeColors).list}
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
        <Pressable style={styles(nightMode, themeColors).noteOverlay} onPress={() => setEditVerseKey(null)}>
          <Pressable onPress={() => {}}>
            <View style={[styles(nightMode, themeColors).noteContainer, { backgroundColor: themeColors.cardBg, borderColor: themeColors.border }]}>
              <TextInput style={[styles(nightMode, themeColors).noteInput, { color: themeColors.text, borderColor: themeColors.border, backgroundColor: nightMode ? '#121520' : '#F0EBE0' }]} value={editText} onChangeText={setEditText} multiline placeholder="Note..." placeholderTextColor={themeColors.subText} />
              <View style={styles(nightMode, themeColors).noteActions}>
                <TouchableOpacity onPress={() => setEditVerseKey(null)} style={[styles(nightMode, themeColors).noteCancelBtn, { backgroundColor: nightMode ? '#2A2E40' : '#E2DCD0' }]}><Text style={{ color: themeColors.text }}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity onPress={saveEditedNote} style={[styles(nightMode, themeColors).noteSaveBtn, { backgroundColor: themeColors.primary }]}><Text style={{ color: '#FFFFFF' }}>Save</Text></TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = (nightMode: boolean, theme: any) => StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 12, paddingBottom: 12 },
  card: { padding: 10, borderRadius: 10, marginBottom: 8, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  cardHeader: { marginBottom: 4 },
  surahLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 2 },
  surahName: { fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  accentLine: { height: 2, width: 34, borderRadius: 1, marginTop: 5, marginBottom: 6 },
  noteText: { fontFamily: 'sans-serif', fontSize: 14, lineHeight: 19, marginBottom: 1 },
  audioRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 5, paddingHorizontal: 12, borderRadius: 14, marginTop: 6 },
  audioLabel: { fontSize: 13, fontWeight: '700' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16, fontWeight: '600' },
  emptySub: { fontSize: 12, marginTop: 4 },
  noteOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)' },
  noteContainer: { width: '80%', borderRadius: 14, padding: 20, borderWidth: 1 },
  noteInput: { borderWidth: 1, borderRadius: 8, padding: 10, height: 100, textAlignVertical: 'top', marginBottom: 15 },
  noteActions: { flexDirection: 'row', justifyContent: 'space-between' },
  noteCancelBtn: { padding: 10, alignItems: 'center', borderRadius: 8, flex: 1, marginRight: 5 },
  noteSaveBtn: { padding: 10, alignItems: 'center', borderRadius: 8, flex: 1, marginLeft: 5 },
});
