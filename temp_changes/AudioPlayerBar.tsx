/**
 * FILE: src/components/audio/AudioPlayerBar.tsx
 * ROLE: Bottom playback bar, two rows: (1) reciter name + "Surah N" + CHANGE button (opens QariSelector);
 *       (2) controls with plain-language labels + tiny captions — ◀ BACK, RESUME/PAUSE (dynamic label),
 *       NEXT ▶, PAGE START (plays from the first verse of this page), SURAH START (plays the surah that
 *       begins on this page; greyed + explains why when none). Fully controlled by props.
 * DEPENDS ON: props onOpenQari/onResume/onPlayPageStart/onPlayNewSurah/canPlayNewSurah/
 *             onPrevVerse/onNextVerse/canStep/isPlaying/nightMode/surahId; Redux audioSlice.currentQari (read-only).
 * USED BY: src/screens/QuranViewScreen.tsx — `{isHeaderVisible && <AudioPlayerBar ... />}`.
 */
import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';

/**
 * AudioPlayerBar (memoized) — presentational bottom bar; makes NO direct calls, fully driven by props.
 * WHAT: Renders the reciter row and the control row.
 * FLOW: 1) theme = nightMode ? darkTheme : lightTheme; disabled text color = disC.
 *       2) RESUME -> onResume; label is dynamic: 'PAUSE' while playing, 'RESUME' when paused/stopped.
 *       3) ◀ BACK / NEXT ▶ -> onPrevVerse/onNextVerse, greyed unless canStep (isPlaying).
 *       4) PAGE START -> onPlayPageStart (page mode: first verse of the page; flowing: surah verse 1).
 *       5) SURAH START -> onPlayNewSurah; greyed unless canPlayNewSurah; caption explains the state.
 *       6) reciter area + CHANGE -> onOpenQari.
 * PROPS: isPlaying — drives the RESUME/PAUSE label; onResume — play/pause toggle;
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
const AudioPlayerBar = ({ onOpenQari, onResume, onPlayPageStart, onPlayNewSurah, canPlayNewSurah, onPrevVerse, onNextVerse, canStep, isPlaying, canResume, nightMode, surahId }: any) => {
  const { currentQari } = useSelector((s: any) => s.audio);
  const theme = nightMode ? darkTheme : lightTheme;
  const disC = nightMode ? '#5a5a5a' : '#b0b0b0';
  const showPlay = !isPlaying && !canResume;
  return (
    <View style={[styles.container, theme.container]}>
      <View style={styles.qariRow}>
        <TouchableOpacity style={styles.qariInfo} onPress={onOpenQari} activeOpacity={0.7}>
          <Text style={[styles.qariName, theme.qariName]} numberOfLines={1}>{currentQari}</Text>
          <Text style={[styles.surahName, theme.surahName]}>Surah {surahId}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.changeBtn, theme.ctrl]} onPress={onOpenQari} activeOpacity={0.7}>
          <Text style={[styles.changeText, theme.ctrlText]}>▾ CHANGE</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.ctrlRow}>
        <TouchableOpacity style={[styles.ctrl, theme.ctrl, !canStep && styles.disabled]} onPress={onPrevVerse} disabled={!canStep} activeOpacity={0.7}>
          <Text style={[styles.ctrlIcon, theme.ctrlText, !canStep && { color: disC }]}>◀</Text>
          <Text style={[styles.ctrlLabel, theme.ctrlText, !canStep && { color: disC }]}>BACK</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.resumeBtn, theme.resumeBtn]} onPress={showPlay ? onPlayPageStart : onResume} activeOpacity={0.85}>
          <Text style={styles.resumeText}>{showPlay ? 'PLAY' : (isPlaying ? 'PAUSE' : 'RESUME')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.ctrl, theme.ctrl, !canStep && styles.disabled]} onPress={onNextVerse} disabled={!canStep} activeOpacity={0.7}>
          <Text style={[styles.ctrlIcon, theme.ctrlText, !canStep && { color: disC }]}>▶</Text>
          <Text style={[styles.ctrlLabel, theme.ctrlText, !canStep && { color: disC }]}>NEXT</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.ctrl, styles.ctrlWide, theme.ctrl]} onPress={onPlayPageStart} activeOpacity={0.7}>
          <Text style={[styles.ctrlLabel, theme.ctrlText]}>PAGE START</Text>
          <Text style={[styles.ctrlCaption, theme.caption]}>plays from this page</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.ctrl, styles.ctrlWide, canPlayNewSurah ? theme.ctrl : styles.disabled]} onPress={onPlayNewSurah} disabled={!canPlayNewSurah} activeOpacity={0.7}>
          <Text style={[styles.ctrlLabel, theme.ctrlText, !canPlayNewSurah && { color: disC }]}>SURAH START</Text>
          <Text style={[styles.ctrlCaption, theme.caption, !canPlayNewSurah && { color: disC }]}>{canPlayNewSurah ? 'plays the new surah from its start' : 'no new surah on this page'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { borderTopWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  qariRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  qariInfo: { flex: 1 },
  qariName: { fontSize: 15, fontWeight: 'bold' },
  surahName: { fontSize: 12, marginTop: 1 },
  changeBtn: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7 },
  changeText: { fontSize: 11, fontWeight: '700' },
  ctrlRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  ctrl: { flex: 1, minHeight: 46, borderRadius: 12, paddingHorizontal: 6, justifyContent: 'center', alignItems: 'center' },
  ctrlWide: { flex: 1.5 },
  ctrlIcon: { fontSize: 11, lineHeight: 13 },
  ctrlLabel: { fontSize: 12, fontWeight: '700', marginTop: 1 },
  ctrlCaption: { fontSize: 8.5, marginTop: 2, textAlign: 'center' },
  resumeBtn: { minWidth: 92, minHeight: 46, borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  resumeText: { color: '#121212', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  disabled: { opacity: 0.45 },
});

const darkTheme = StyleSheet.create({
  container: { backgroundColor: '#1a1a2e', borderTopColor: '#2a2a2a' },
  qariName: { color: '#fff' },
  surahName: { color: '#b0b0b0' },
  ctrl: { backgroundColor: 'rgba(255,255,255,0.08)' },
  ctrlText: { color: '#e8e8e8' },
  caption: { color: '#9a9a9a' },
  resumeBtn: { backgroundColor: '#00d4aa' },
});

const lightTheme = StyleSheet.create({
  container: { backgroundColor: '#f5f5f5', borderTopColor: 'rgba(0,0,0,0.12)' },
  qariName: { color: '#1a1a1a' },
  surahName: { color: '#777' },
  ctrl: { backgroundColor: 'rgba(0,0,0,0.06)' },
  ctrlText: { color: '#1a1a1a' },
  caption: { color: '#8a8a8a' },
  resumeBtn: { backgroundColor: '#00d4aa' },
});

export default memo(AudioPlayerBar);
