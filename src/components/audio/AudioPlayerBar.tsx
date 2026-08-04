/**
 * FILE: src/components/audio/AudioPlayerBar.tsx
 * ROLE: Bottom playback bar (two rows) — row 1: qari name + "Surah N" + expand (opens QariSelector);
 *       row 2: verse controls — ◀ prev, RESUME (play/pause toggle, renamed), ▶ next, PLAY (from the
 *       page's first verse / surah start), NEW SURAH (plays the surah that begins on this page;
 *       greyed when none). Fully controlled by props.
 * DEPENDS ON: props onOpenQari/onResume/onPlayPageStart/onPlayNewSurah/canPlayNewSurah/
 *             onPrevVerse/onNextVerse/canStep/isPlaying/nightMode/surahId; Redux audioSlice.currentQari (read-only).
 * USED BY: src/screens/QuranViewScreen.tsx — `{isHeaderVisible && <AudioPlayerBar ... />}`.
 */
import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';

/**
 * AudioPlayerBar (memoized) — presentational bottom bar; makes NO direct calls, fully driven by props.
 * WHAT: Renders the qari row and the control row.
 * FLOW: 1) theme = nightMode ? darkTheme : lightTheme; 2) RESUME -> onResume (pause when playing,
 *       resume/start otherwise); 3) ◀/▶ -> onPrevVerse/onNextVerse, greyed unless canStep;
 *       4) PLAY -> onPlayPageStart; 5) NEW SURAH -> onPlayNewSurah, greyed unless canPlayNewSurah;
 *       6) qari name area + expand -> onOpenQari.
 * PROPS: isPlaying — playback state for the RESUME glyph; onResume — play/pause toggle;
 *        onPlayPageStart — start playback from the page's first verse (or current surah verse 1 in flowing);
 *        onPlayNewSurah — start from verse 1 of the surah beginning on this page; canPlayNewSurah — enables it;
 *        onPrevVerse/onNextVerse — step playback to the adjacent verse; canStep — enables them (isPlaying);
 *        onOpenQari — opens the QariSelector modal; surahId — shown in the "Surah N" label; nightMode — theme.
 * CALLS: onResume -> QuranViewScreen.togglePlayAudio; onPlayPageStart -> QuranViewScreen.playPageStart;
 *        onPlayNewSurah -> QuranViewScreen.playNewSurah; onPrevVerse/onNextVerse -> QuranViewScreen.stepVerse(±1);
 *        onOpenQari -> setShowQariModal(true).
 * CALLED BY: QuranViewScreen, gated on isHeaderVisible (bar disappears when the header is hidden — even mid-playback).
 * AFFECTS: Nothing directly (read-only); indirectly drives audioSlice.isPlaying via the parent handlers.
 */
const AudioPlayerBar = ({ onOpenQari, onResume, onPlayPageStart, onPlayNewSurah, canPlayNewSurah, onPrevVerse, onNextVerse, canStep, isPlaying, nightMode, surahId }: any) => {
  const { currentQari } = useSelector((s: any) => s.audio);
  const theme = nightMode ? darkTheme : lightTheme;
  const dimC = nightMode ? '#5a5a5a' : '#aaa';
  return (
    <View style={[styles.container, theme.container]}>
      <View style={styles.qariRow}>
        <TouchableOpacity style={styles.qariInfo} onPress={onOpenQari}>
          <Text style={[styles.qariName, theme.qariName]}>{currentQari}</Text>
          <Text style={[styles.surahName, theme.surahName]}>Surah {surahId}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onOpenQari} style={styles.expandBtn}>
          <Text style={[styles.expandIcon, theme.expandIcon]}>⌃</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.ctrlRow}>
        <TouchableOpacity style={[styles.ctrl, canStep ? theme.ctrl : styles.ctrlOff]} onPress={onPrevVerse} disabled={!canStep}>
          <Text style={[styles.ctrlIcon, canStep ? theme.ctrlText : { color: dimC }]}>◀</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.resumeBtn, theme.resumeBtn]} onPress={onResume}>
          <Text style={styles.resumeText}>{isPlaying ? '⏸ RESUME' : '▶ RESUME'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.ctrl, canStep ? theme.ctrl : styles.ctrlOff]} onPress={onNextVerse} disabled={!canStep}>
          <Text style={[styles.ctrlIcon, canStep ? theme.ctrlText : { color: dimC }]}>▶</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.ctrl, styles.ctrlWide, theme.ctrl]} onPress={onPlayPageStart}>
          <Text style={[styles.ctrlText, theme.ctrlText]}>PLAY</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.ctrl, styles.ctrlWide, canPlayNewSurah ? theme.ctrl : styles.ctrlOff]} onPress={onPlayNewSurah} disabled={!canPlayNewSurah}>
          <Text style={[styles.ctrlText, canPlayNewSurah ? theme.ctrlText : { color: dimC }]}>NEW SURAH</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { borderTopWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  qariRow: { flexDirection: 'row', alignItems: 'center' },
  qariInfo: { flex: 1 },
  qariName: { fontSize: 15, fontWeight: 'bold' },
  surahName: { fontSize: 12, marginTop: 1 },
  expandBtn: { padding: 8 },
  expandIcon: { fontSize: 18 },
  ctrlRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6 },
  ctrl: { height: 36, borderRadius: 18, paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center' },
  ctrlWide: { flex: 1 },
  ctrlOff: { backgroundColor: 'rgba(128,128,128,0.15)' },
  ctrlIcon: { fontSize: 14 },
  ctrlText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  resumeBtn: { height: 40, borderRadius: 20, paddingHorizontal: 18, justifyContent: 'center', alignItems: 'center' },
  resumeText: { color: '#121212', fontSize: 13, fontWeight: '800' },
});

const darkTheme = StyleSheet.create({
  container: { backgroundColor: '#1a1a2e', borderTopColor: '#2a2a2a' },
  qariName: { color: '#fff' },
  surahName: { color: '#b0b0b0' },
  expandIcon: { color: '#b0b0b0' },
  ctrl: { backgroundColor: 'rgba(255,255,255,0.08)' },
  ctrlText: { color: '#e8e8e8' },
  resumeBtn: { backgroundColor: '#00d4aa' },
});

const lightTheme = StyleSheet.create({
  container: { backgroundColor: '#f5f5f5', borderTopColor: 'rgba(0,0,0,0.12)' },
  qariName: { color: '#1a1a1a' },
  surahName: { color: '#777' },
  expandIcon: { color: '#777' },
  ctrl: { backgroundColor: 'rgba(0,0,0,0.06)' },
  ctrlText: { color: '#1a1a1a' },
  resumeBtn: { backgroundColor: '#00d4aa' },
});

export default memo(AudioPlayerBar);
