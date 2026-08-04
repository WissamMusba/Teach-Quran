/**
 * FILE: src/store/audioSlice.ts
 * ROLE: Audio playback flags (isPlaying, currentQari).
 * DEPENDS ON: none (Redux Toolkit createSlice only).
 * USED BY: src/components/audio/QariSelector.tsx (setQari + read), src/components/audio/AudioPlayerBar.tsx
 *          (read), src/screens/QuranViewScreen.tsx (setPlaying + read).
 * NOTES (anatomy): DEAD members — setAudioPosition, setAudioDuration, setCurrentTrack and fields
 *          currentSurah, currentAyah, position, duration: zero dispatchers/readers in src/. Cut in rebuild.
 */
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isPlaying: false,        // playback running (set by QuranViewScreen play/pause flows)
  currentQari: 'Mishary Al-Afasy', // active reciter id/name (QariSelector)
  currentSurah: 1,         // DEAD field — no writer/reader in src/
  currentAyah: 1,          // DEAD field — no writer/reader in src/
  position: 0,             // DEAD field — no writer/reader in src/
  duration: 0,             // DEAD field — no writer/reader in src/
};

export const audioSlice = createSlice({
  name: 'audio',
  initialState,
  reducers: {
    /**
     * WHAT: Sets isPlaying (playback running flag).
     * CALLED BY: QuranViewScreen.tsx (many play/pause handlers — :587/:594/:782/:794-800/:818/:822-838, mic record :1016).
     * AFFECTS: QuranViewScreen render (isPlaying), AudioPlayerBar (prop isPlaying).
     */
    setPlaying: (state, action) => { state.isPlaying = action.payload; },
    /**
     * WHAT: Sets the active qari.
     * CALLED BY: QariSelector.tsx:34 (qari row tap).
     * AFFECTS: QuranViewScreen audio fetch (qariId), AudioPlayerBar display, QariSelector selected row.
     */
    setQari: (state, action) => { state.currentQari = action.payload; },
    /**
     * WHAT: Sets position (seconds).
     * CALLED BY: NOBODY — zero dispatchers in src/. DEAD ACTION (see header note).
     * AFFECTS: nothing.
     */
    setAudioPosition: (state, action) => { state.position = action.payload; },
    /**
     * WHAT: Sets duration (seconds).
     * CALLED BY: NOBODY — zero dispatchers in src/. DEAD ACTION (see header note).
     * AFFECTS: nothing.
     */
    setAudioDuration: (state, action) => { state.duration = action.payload; },
    /**
     * WHAT: Sets currentSurah/currentAyah track.
     * CALLED BY: NOBODY — zero dispatchers in src/. DEAD ACTION (see header note).
     * AFFECTS: nothing (the fields themselves are unread).
     */
    setCurrentTrack: (state, action) => {
      state.currentSurah = action.payload.surah;
      state.currentAyah = action.payload.ayah;
    }
  }
});

export const { setPlaying, setQari, setAudioPosition, setAudioDuration, setCurrentTrack } = audioSlice.actions;
export default audioSlice.reducer;
