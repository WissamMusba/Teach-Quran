import { firestore, getUserId } from './firebase';
import { getCachedStudentList, cacheStudentList } from '../database/localDB';
export const createStudent = async (name: string) => {
  const userId = getUserId();
  if (!userId) return { success: false, error: 'No user' };
  const ref = await firestore().collection('users').doc(userId).collection('students').add({ name, createdAt: firestore.FieldValue.serverTimestamp() });
  await ref.collection('data').doc('studentData').set({ bookmarks: {}, highlights: {}, drawings: {}, notes: {}, history: { actions: [], currentIndex: -1 } });
  return { success: true, studentId: ref.id };
};
export const getStudents = async () => {
  const userId = getUserId();
  if (!userId) return { success: false, error: 'No user' };
  try {
    const cached = await getCachedStudentList();
    if (cached && cached.length > 0) { refreshInBackground(userId); return { success: true, students: cached }; }
    const snap = await firestore().collection('users').doc(userId).collection('students').orderBy('createdAt', 'desc').get();
    const students = snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) }));
    await cacheStudentList(students);
    return { success: true, students };
  } catch (e: any) {
    const cached = await getCachedStudentList();
    if (cached && cached.length > 0) return { success: true, students: cached };
    return { success: false, error: e?.message };
  }
};

async function refreshInBackground(uid: string) {
  try {
    const snap = await firestore().collection('users').doc(uid).collection('students').orderBy('createdAt', 'desc').get();
    await cacheStudentList(snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) })));
  } catch {}
}
export const updateStudent = async (id: string, name: string) => {
  const userId = getUserId();
  if (!userId) return { success: false, error: 'No user' };
  await firestore().collection('users').doc(userId).collection('students').doc(id).update({ name });
  return { success: true };
};

export const deleteStudent = async (id: string) => {
  const userId = getUserId();
  if (!userId) return { success: false, error: 'No user' };
  await firestore().collection('users').doc(userId).collection('students').doc(id).delete();
  return { success: true };
};