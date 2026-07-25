import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isPlaying: false,
  currentQari: 'Mishary Al-Afasy',
  currentSurah: 1,
  currentAyah: 1,
  position: 0,
  duration: 0,
};

export const audioSlice = createSlice({
  name: 'audio',
  initialState,
  reducers: {
    setPlaying: (state, action) => { state.isPlaying = action.payload; },
    setQari: (state, action) => { state.currentQari = action.payload; },
    setAudioPosition: (state, action) => { state.position = action.payload; },
    setAudioDuration: (state, action) => { state.duration = action.payload; },
    setCurrentTrack: (state, action) => {
      state.currentSurah = action.payload.surah;
      state.currentAyah = action.payload.ayah;
    }
  }
});

export const { setPlaying, setQari, setAudioPosition, setAudioDuration, setCurrentTrack } = audioSlice.actions;
export default audioSlice.reducer;
