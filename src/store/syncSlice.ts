/**
 * FILE: src/store/syncSlice.ts
 * ROLE: Sync status flag + pending-change counter for UI badges.
 * DEPENDS ON: none (Redux Toolkit createSlice only).
 * USED BY: src/App.tsx (setSyncing/setSynced/setOffline), src/screens/DashboardScreen.tsx
 *          (same three + reads), src/screens/QuranViewScreen.tsx (addPendingChange);
 *          readers src/components/sync/SyncIndicator.tsx, src/components/common/SyncStatus.tsx,
 *          DashboardScreen.tsx.
 */
import { createSlice } from '@reduxjs/toolkit';
export const syncSlice = createSlice({
  name: 'sync', initialState: { status: 'idle', /* 'idle'|'syncing'|'synced'|'offline' */ pendingChanges: 0 /* count of unsynced annotation saves (increments only; reset by setSynced) */ },
  reducers: {
    /**
     * WHAT: status = 'syncing'.
     * CALLED BY: App.tsx:69/:78/:90 (initial sync, 30-min interval, AppState foreground/background);
     *            DashboardScreen.tsx:88 (handleManualSync, guarded by pendingChanges > 0).
     * AFFECTS: SyncIndicator fade-in, SyncStatus badge, Dashboard Sync button label.
     */
    setSyncing: (state) => { state.status = 'syncing'; },
    /**
     * WHAT: status = 'synced', pendingChanges reset to 0.
     *       NOTE (anatomy): App.tsx:71/:80 dispatch setSynced(new Date().toISOString()) — the reducer
     *       IGNORES the payload, so no "last synced at" timestamp is ever stored.
     * CALLED BY: App.tsx:71/:80/:90; DashboardScreen.tsx:90 (after processSyncQueue success).
     * AFFECTS: SyncIndicator fade-out, SyncStatus green dot, Dashboard badge + manual-sync gate.
     */
    setSynced: (state) => { state.status = 'synced'; state.pendingChanges = 0; },
    /**
     * WHAT: status = 'offline'.
     * CALLED BY: App.tsx:72/:81/:90; DashboardScreen.tsx:90 (processSyncQueue failure).
     * AFFECTS: SyncIndicator 'Sync failed' label, SyncStatus red 'Offline (n)'.
     */
    setOffline: (state) => { state.status = 'offline'; },
    /**
     * WHAT: pendingChanges += 1 (fires on EVERY debounced annotation save).
     * CALLED BY: QuranViewScreen.tsx:549 (flushPendingSave: saveStudentData + addToSyncQueue then increment).
     * AFFECTS: SyncStatus count, Dashboard Sync button badge + manual-sync gate (DashboardScreen.tsx).
     */
    addPendingChange: (state) => { state.pendingChanges += 1; }
  }
});
export const { setSyncing, setSynced, setOffline, addPendingChange } = syncSlice.actions;
export default syncSlice.reducer;