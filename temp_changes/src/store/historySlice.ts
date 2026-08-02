import { createSlice } from '@reduxjs/toolkit';
export const historySlice = createSlice({
  name: 'history', initialState: { actions: [] as any[], currentIndex: -1 },
  reducers: {
    addAction: (state, action) => { state.actions = state.actions.slice(0, state.currentIndex + 1); state.actions.push(action.payload); state.currentIndex = state.actions.length - 1; },
    undo: (state) => { if (state.currentIndex >= 0) state.currentIndex--; },
    redo: (state) => { if (state.currentIndex < state.actions.length - 1) state.currentIndex++; }
  }
});
export const { addAction, undo, redo } = historySlice.actions;
export default historySlice.reducer;