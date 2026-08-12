/**
 * FILE: src/components/audio/AudioPlayerBar.tsx
 * ROLE: Bottom playback bar, two rows: (1) reciter name + "Surah N" + LOOP SETTINGS + CHANGE button
 *       (opens QariSelector); (2) compact controls — circular ◀ (prev verse), big teal PLAY/PAUSE circle
 *       (SVG icons; fresh state plays from the page's first verse, paused state resumes),
 *       circular ▶ (next verse), LOOP START (greyed until the loop is enabled in Loop Settings —
 *       label flips to LOOP END while a loop pass is playing), SURAH START (plays
 *       the surah that begins on this page; greyed when none).
 * DEPENDS ON: props onOpenQari/onOpenLoopSettings/onResume/onPlaySurahStart/onPlayPageStart/onPlayNewSurah/
 *             canPlayNewSurah/onPrevVerse/onNextVerse/canStep/isPlaying/canResume/nightMode/surahId;
 *             Redux audioSlice.currentQari (read-only); react-native-svg for the inline control icons.
 * USED BY: src/screens/QuranViewScreen.tsx — `{isHeaderVisible && <AudioPlayerBar ... />}`.
 */
import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import Svg, { Path } from 'react-native-svg';

const IconPlay = ({ c, s = 18 }: { c: string; s?: number }) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill={c}><Path d="M8 5v14l11-7z" /></Svg>
);
const IconPause = ({ c, s = 18 }: { c: string; s?: number }) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill={c}><Path d="M7 4h3.5v16H7zM13.5 4H17v16h-3.5z" /></Svg>
);
const IconPrevTrack = ({ c, s = 14 }: { c: string; s?: number }) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill={c}><Path d="M5.5 4v16H8V4zM17.5 5.5l-9 5.5 9 5.5z" /></Svg>
);
const IconNextTrack = ({ c, s = 14 }: { c: string; s?: number }) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill={c}><Path d="M16 4h2.5v16H16zM4.5 5.5l8.5 5.75-8.5 5.75z" /></Svg>
);

/**
 * AudioPlayerBar (memoized) — presentational bottom bar; makes NO direct calls, fully driven by props.
 * WHAT: Renders the reciter row and the control row.
 * FLOW: 1) theme = nightMode ? darkTheme : lightTheme; disabled color = disC.
*       2) Center circle: shows PAUSE bars while playing, PLAY triangle otherwise; press routes to
 *          onPlayPageStart when fresh (nothing to resume, not playing) else onResume (pause/resume).
 *       3) Circular ◀ / ▶ -> onPrevVerse/onNextVerse, greyed unless canStep (isPlaying).
 *       4) LOOP START -> onPlayPageStart; greyed unless loopEnabled. Label flips to LOOP END
 *          while the loop is actively playing.
 *       5) SURAH START -> onPlayNewSurah; greyed unless canPlayNewSurah.
 *       6) reciter area + LOOP SETTINGS + CHANGE -> onOpenQari / onOpenLoopSettings / onOpenQari.
 * PROPS: isPlaying — drives the center icon; onResume — play/pause toggle;
 *        onPlayPageStart — start playback from the page's first verse (or the loop range
 *        when a loop is enabled);
 *        onPlayNewSurah — start from verse 1 of the surah beginning on this page; canPlayNewSurah — enables it;
 *        onPrevVerse/onNextVerse — step playback to the adjacent verse; canStep — enables them (isPlaying);
 *        onOpenQari — opens the QariSelector modal; onOpenLoopSettings — opens the Loop Settings screen;
 *        surahId — shown in the "Surah N" label; nightMode — theme.
 * CALLS: onResume/onPlaySurahStart -> QuranViewScreen play/pause handlers; onPlayPageStart/onPlayNewSurah
 *        -> QuranViewScreen playPageStart/playNewSurah; onPrevVerse/onNextVerse -> stepVerse(±1);
 *        onOpenQari -> setShowQariModal(true); onOpenLoopSettings -> navigation.navigate('LoopSettings').
 * CALLED BY: QuranViewScreen, gated on isHeaderVisible (bar disappears when the header is hidden — even mid-playback).
 * AFFECTS: Nothing directly (read-only); indirectly drives audioSlice.isPlaying via the parent handlers.
 */
const AudioPlayerBar = ({ onOpenQari, onOpenLoopSettings, onResume, onPlayPageStart, onPlayNewSurah, canPlayNewSurah, onPrevVerse, onNextVerse, canStep, isPlaying, canResume, loopEnabled, nightMode, surahId }: any) => {
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
        <TouchableOpacity style={[styles.changeBtn, theme.ctrl]} onPress={onOpenLoopSettings} activeOpacity={0.7}>
          <Text style={[styles.changeText, theme.ctrlText]}>LOOP SETTINGS</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.changeBtn, theme.ctrl]} onPress={onOpenQari} activeOpacity={0.7}>
          <Text style={[styles.changeText, theme.ctrlText]}>▾ CHANGE</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.ctrlRow}>
        <TouchableOpacity style={[styles.circle, theme.ctrl, !canStep && styles.disabled]} onPress={onPrevVerse} disabled={!canStep} activeOpacity={0.7}>
          <IconPrevTrack c={String(canStep ? theme.ctrlText : disC)} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.playCircle, theme.resumeBtn]} onPress={showPlay ? onPlayPageStart : onResume} activeOpacity={0.85}>
          {isPlaying ? <IconPause c="#121212" s={22} /> : <IconPlay c="#121212" s={22} />}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.circle, theme.ctrl, !canStep && styles.disabled]} onPress={onNextVerse} disabled={!canStep} activeOpacity={0.7}>
          <IconNextTrack c={String(canStep ? theme.ctrlText : disC)} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.action, loopEnabled ? theme.ctrl : styles.disabled]} onPress={onPlayPageStart} disabled={!loopEnabled} activeOpacity={0.7}>
          <Text style={[styles.actionText, theme.ctrlText, !loopEnabled && { color: disC }]}>{loopEnabled && isPlaying ? 'LOOP END' : 'LOOP START'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.action, canPlayNewSurah ? theme.ctrl : styles.disabled]} onPress={onPlayNewSurah} disabled={!canPlayNewSurah} activeOpacity={0.7}>
          <Text style={[styles.actionText, theme.ctrlText, !canPlayNewSurah && { color: disC }]}>SURAH START</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { borderTopWidth: 1, paddingHorizontal: 12, paddingVertical: 5 },
  qariRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  qariInfo: { flex: 1 },
  qariName: { fontSize: 14, fontWeight: 'bold' },
  surahName: { fontSize: 11, marginTop: 1 },
  changeBtn: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  changeText: { fontSize: 10, fontWeight: '700' },
  ctrlRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  circle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  playCircle: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  action: { flex: 1, minHeight: 34, borderRadius: 10, paddingHorizontal: 4, justifyContent: 'center', alignItems: 'center' },
  actionText: { fontSize: 10, fontWeight: '700' },
  disabled: { opacity: 0.45 },
});

const darkTheme = StyleSheet.create({
  container: { backgroundColor: '#1a1a2e', borderTopColor: '#2a2a2a' },
  qariName: { color: '#fff' },
  surahName: { color: '#b0b0b0' },
  ctrl: { backgroundColor: 'rgba(255,255,255,0.08)' },
  ctrlText: { color: '#e8e8e8' },
  caption: { color: '#9a9a9a' },
  resumeBtn: { backgroundColor: (nightMode ? '#7BA7DB' : '#1C3D72') },
});

const lightTheme = StyleSheet.create({
  container: { backgroundColor: '#f5f5f5', borderTopColor: 'rgba(0,0,0,0.12)' },
  qariName: { color: '#1a1a1a' },
  surahName: { color: '#777' },
  ctrl: { backgroundColor: 'rgba(0,0,0,0.06)' },
  ctrlText: { color: '#1a1a1a' },
  caption: { color: '#8a8a8a' },
  resumeBtn: { backgroundColor: (nightMode ? '#7BA7DB' : '#1C3D72') },
});

export default memo(AudioPlayerBar);
