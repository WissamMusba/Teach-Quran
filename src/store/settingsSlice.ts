/**
 * FILE: src/store/settingsSlice.ts
 * ROLE: Reader appearance + reading preferences (all persisted).
 */
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  nightMode: true,            // dark theme (defaults ON)
  colorTheme: 'classic' as 'classic' | 'emerald' | 'obsidian',
  textBrightness: 255,        // 0-255 alpha of Arabic text color
  bgBrightness: 18,           // 0-255 background dim
  translationTextSize: 16,
  mushafSplit: false,         // tablet two-page spread
  playBasmala: true,          // play the reciter's basmala before verse 1 of a surah
  adCollapsed: false,         // CollapsibleBannerAd user preference
  tutorialDone: false,        // interactive walkthrough finished once
  legacySmooth: false,        // legacy smooth scroll flag
};

export const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setTutorialDone: (state, action) => { state.tutorialDone = action.payload === true; },
    toggleLegacySmooth: (state) => { state.legacySmooth = !state.legacySmooth; },
    toggleNightMode: (state) => { state.nightMode = !state.nightMode; },
    setColorTheme: (state, action) => { state.colorTheme = action.payload; },
    setTextBrightness: (state, action) => { state.textBrightness = action.payload; },
    setBgBrightness: (state, action) => { state.bgBrightness = action.payload; },
    setMushafSplit: (state, action) => { state.mushafSplit = action.payload; },
    togglePlayBasmala: (state) => { state.playBasmala = !state.playBasmala; },
    setAdCollapsed: (state, action) => { state.adCollapsed = action.payload === true; },
  }
});

export const {
  toggleNightMode,
  setColorTheme,
  setTextBrightness,
  setBgBrightness,
  setMushafSplit,
  togglePlayBasmala,
  setAdCollapsed,
  setTutorialDone,
  toggleLegacySmooth,
} = settingsSlice.actions;

export default settingsSlice.reducer;
