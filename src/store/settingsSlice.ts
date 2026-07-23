import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  nightMode: true,
  textBrightness: 255,
  bgBrightness: 18,
  translationTextSize: 16,
  showPageInfo: true,
};

export const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    toggleNightMode: (state) => { state.nightMode = !state.nightMode; },
    setTextBrightness: (state, action) => { state.textBrightness = action.payload; },
    setBgBrightness: (state, action) => { state.bgBrightness = action.payload; },
    setTranslationTextSize: (state, action) => { state.translationTextSize = action.payload; },
    toggleShowPageInfo: (state) => { state.showPageInfo = !state.showPageInfo; },
  }
});

export const { toggleNightMode, setTextBrightness, setBgBrightness, setTranslationTextSize, toggleShowPageInfo } = settingsSlice.actions;
export default settingsSlice.reducer;
