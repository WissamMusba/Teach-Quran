import { firestore, getUserId } from './firebase';
import { getPendingSyncStudents, clearSyncQueueForStudent, getStudentData } from '../database/localDB';

const serverNow = (): any => {
  try {
    const FV = (firestore as any).FieldValue;
    if (FV && typeof FV.serverTimestamp === 'function') return FV.serverTimestamp();
  } catch {}
  return new Date().toISOString();
};

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
