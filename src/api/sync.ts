/**
 * FILE: src/api/sync.ts
 * ROLE: Push-only sync engine: reads dirty students from SQLite, uploads each
 *       student's monolithic blob to Firestore, clears the queue on success.
 * DEPENDS ON: src/api/firebase.ts (firestore, getUserId auth state),
 *             src/database/localDB.ts (sync_queue + student_data_cache tables:
 *             getPendingSyncStudents, clearSyncQueueForStudent, getStudentData)
 * USED BY: App.tsx (initial sync after auth, 30-min SYNC_INTERVAL, AppState
 *          change triggers), DashboardScreen.tsx (manual sync button)
 */
import { firestore, getUserId } from './firebase';
import { getPendingSyncStudents, clearSyncQueueForStudent, getStudentData } from '../database/localDB';

/**
 * WHAT: Firestore server timestamp helper with a client-clock fallback.
 * FLOW: Try firestore.FieldValue.serverTimestamp(); if unavailable, return an
 *       ISO string. Blends server and client clocks (see NOTES).
 * CALLS: (firestore).FieldValue.serverTimestamp -> authoritative write time
 * CALLED BY: processSyncQueue (self, inline)
 * AFFECTS: Firestore write field updatedAt (used by nothing today — display
 *          only)
 * NOTES: [v1] Mixed timestamp types (Timestamp vs string) make ordering
 *        unreliable. [v4] replaced by FieldValue.increment monotonic counters
 *        (SYNC_OPTIMIZATION.txt).
 */
const serverNow = (): any => {
  try {
    const FV = (firestore as any).FieldValue;
    if (FV && typeof FV.serverTimestamp === 'function') return FV.serverTimestamp();
  } catch {}
  return new Date().toISOString();
};

/**
 * WHAT: Main entry point of the ENTIRE sync feature. Uploads every dirty
 *       student's monolithic blob to users/{uid}/students/{sid}/data/
 *       studentData (merge:true), then clears the queue. Called from 4
 *       triggers.
 * FLOW: 1) getUserId() -> bail 'Not authenticated' if logged out.
 *       2) getPendingSyncStudents() -> distinct dirty studentIds from
 *          sync_queue WHERE synced=0. Empty -> success(0,0).
 *       3) For each dirty student: getStudentData(sid) -> full blob from
 *          student_data_cache (the ENTIRE student: bookmarks, highlights,
 *          drawings, notes, lastRead). Missing blob -> clear queue row,
 *          continue.
 *       4) firestore set() of the whole blob (+ updatedAt: serverNow()) at
 *          users/{uid}/students/{sid}/data/studentData with merge:true.
 *       5) clearSyncQueueForStudent(sid) -> delete queue row. synced++.
 *       6) Per-student catch -> failed++, leave queue row dirty (retry next
 *          trigger).
 * CALLS: getUserId -> auth guard
 *        getPendingSyncStudents -> dirty student list (localDB.ts)
 *        getStudentData -> local blob to upload (localDB.ts)
 *        firestore().collection(...).set() -> cloud write (merge)
 *        clearSyncQueueForStudent -> queue cleanup (localDB.ts)
 * CALLED BY: App.tsx (initial sync after auth; 30-min interval, SYNC_INTERVAL;
 *            AppState change active<->background), DashboardScreen.tsx (manual
 *            sync on screen focus)
 * AFFECTS: Cloud: users/{uid}/students/{sid}/data/studentData (overwritten).
 *          Local: sync_queue rows deleted on success (synced state lost — no
 *          history). UI: syncSlice.setSyncing/setSynced/setOffline drive the
 *          SyncStatus/SyncIndicator components (dispatched by the callers).
 * NOTES: [v1 LIMITATION] Blob is 400KB-1.3MB; >1MB documents FAIL SILENTLY in
 *        Firestore (student data silently lost). Push-only, NO pull — a
 *        second device never receives data, no conflict resolution. Audio
 *        note paths reference local files only. Sync queue row data is always
 *        '{}' — the real payload is re-read from student_data_cache at push
 *        time. [v4] whole file replaced by per-canvas push + pull
 *        (SYNC_OPTIMIZATION.txt §5.5).
 */
export const processSyncQueue = async (): Promise<{ success: boolean; synced?: number; failed?: number; error?: string }> => {
  const userId = getUserId();
  if (!userId) return { success: false, error: 'Not authenticated' };
  try {
    let dirtyIds: string[] = [];
    try { dirtyIds = await getPendingSyncStudents(); } catch { return { success: false, error: 'queue read failed' }; }
    if (!dirtyIds || dirtyIds.length === 0) return { success: true, synced: 0, failed: 0 };

    let synced = 0, failed = 0;
    for (const sid of dirtyIds) {
      try {
        const local = await getStudentData(sid);
        if (!local) { try { await clearSyncQueueForStudent(sid); } catch {} continue; }
        await firestore()
          .collection('users').doc(userId)
          .collection('students').doc(sid)
          .collection('data').doc('studentData')
          .set({ ...(local as object), updatedAt: serverNow() }, { merge: true });
        try { await clearSyncQueueForStudent(sid); } catch {}
        synced++;
      } catch (e) { console.warn(`Sync failed for ${sid}:`, e); failed++; }
    }
    return { success: true, synced, failed };
  } catch (e: any) {
    console.warn('Sync failed:', e?.message);
    return { success: false, error: e?.message };
  }
};
