import { createSlice } from '@reduxjs/toolkit';
export const quranSlice = createSlice({
  name: 'quran', 
  initialState: { currentSurahId: 1, verses: [] as any[], showTranslation: false, fontSize: 'medium' as 'small' | 'medium' | 'large' | 'xl', readingMode: 'continuous' as 'continuous' | 'page' | 'ayah', surahNames: {} as any, flashingVerse: null as number | null, lastReadSurah: 1, lastReadVerse: 1, textStyle: 'indopak' as 'indopak' | 'uthmani' },
  reducers: {
    setSurah: (state, action) => { state.currentSurahId = action.payload.surahId; state.verses = action.payload.verses; },
    toggleTranslation: (state) => { state.showTranslation = !state.showTranslation; },
    setFontSize: (state, action) => { state.fontSize = action.payload; },
    setReadingMode: (state, action) => { state.readingMode = action.payload; },
    setSurahNames: (state, action) => { state.surahNames = action.payload; },
    setFlashingVerse: (state, action) => { state.flashingVerse = action.payload; },
    setLastRead: (state, action) => { state.lastReadSurah = action.payload.surah; state.lastReadVerse = action.payload.verse; },
    setTextStyle: (state, action) => { state.textStyle = action.payload; }
  }
});
export const { setSurah, toggleTranslation, setFontSize, setReadingMode, setSurahNames, setFlashingVerse, setLastRead, setTextStyle } = quranSlice.actions;
export default quranSlice.reducer;