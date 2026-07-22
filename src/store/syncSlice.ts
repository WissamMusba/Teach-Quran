import { createSlice } from '@reduxjs/toolkit';
export const syncSlice = createSlice({
  name: 'sync', initialState: { status: 'idle', pendingChanges: 0 },
  reducers: {
    setSyncing: (state) => { state.status = 'syncing'; },
    setSynced: (state) => { state.status = 'synced'; state.pendingChanges = 0; },
    setOffline: (state) => { state.status = 'offline'; },
    addPendingChange: (state) => { state.pendingChanges += 1; }
  }
});
export const { setSyncing, setSynced, setOffline, addPendingChange } = syncSlice.actions;
export default syncSlice.reducer;