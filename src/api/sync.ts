import { firestore, getUserId } from './firebase';
import { getPendingSyncQueue, markQueueItemsSynced, getStudentData, saveStudentData } from '../database/localDB';

export const processSyncQueue = async () => {
  const userId = getUserId();
  if (!userId) return { success: false, error: 'No user' };

  try {
    const queue = await getPendingSyncQueue();
    if (queue.length === 0) return { success: true, synced: 0 };

    const uniqueIds = [...new Set(queue.map(item => item.studentId))];
    let syncedCount = 0;
    let batch = firestore().batch();
    let opsInBatch = 0;

    for (const studentId of uniqueIds) {
      const localData = await getStudentData(studentId);
      if (!localData) continue;

      const ref = firestore().collection('users').doc(userId).collection('students').doc(studentId).collection('data').doc('studentData');
      const cloudDoc = await ref.get();
      const cloudData = cloudDoc.exists ? cloudDoc.data() : null;

      const localTime = localData.updatedAt ? new Date(localData.updatedAt).getTime() : 0;
      const cloudTime = cloudData?.updatedAt?.toMillis ? cloudData.updatedAt.toMillis() : 0;

      if (localTime >= cloudTime) {
        batch.set(ref, { 
          ...localData, 
          updatedAt: firestore.FieldValue.serverTimestamp() 
        }, { merge: true });
        syncedCount++;
        opsInBatch++;
      } else {
        await saveStudentData(studentId, { ...cloudData, updatedAt: new Date(cloudTime) });
      }

      // ⚠️ CRITICAL FIX: Firestore max batch size is 500. Chunk it.
      if (opsInBatch >= 400) {
        await batch.commit();
        batch = firestore().batch(); // Start a new batch
        opsInBatch = 0;
      }
    }

    // Commit any remaining operations
    if (opsInBatch > 0) {
      await batch.commit();
    }

    await markQueueItemsSynced(queue.map(item => item.id));
    return { success: true, synced: syncedCount };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};