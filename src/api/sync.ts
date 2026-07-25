import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { getPendingSyncStudents, clearSyncQueueForStudent, getStudentData } from '../database/localDB';
import type { SyncResponse, StudentData } from '../utils/types';
export async function processSyncQueue(): Promise<SyncResponse> {
  const user = auth().currentUser;
  if (!user) return { success: false, error: 'Not authenticated' };
  try {
    const dirtyIds = await getPendingSyncStudents();
    if (dirtyIds.length === 0) return { success: true, synced: 0, failed: 0 };
    let synced = 0, failed = 0;
    for (const sid of dirtyIds) {
      try {
        const local = (await getStudentData(sid)) as StudentData | null;
        if (!local) { await clearSyncQueueForStudent(sid); continue; }
        await firestore().collection('users').doc(user.uid).collection('students').doc(sid).collection('data').doc('studentData')
          .set({ ...local, updatedAt: firestore.FieldValue.serverTimestamp() }, { merge: true });
        await clearSyncQueueForStudent(sid); synced++;
      } catch (e) { console.warn(`Sync failed for ${sid}:`, e); failed++; }
    }
    return { success: true, synced, failed };
  } catch (e: any) { console.warn('Sync failed:', e.message); return { success: false, error: e.message }; }
}
