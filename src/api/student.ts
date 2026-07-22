import { firestore, getUserId } from './firebase';
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
  const snap = await firestore().collection('users').doc(userId).collection('students').orderBy('createdAt', 'desc').get();
  return { success: true, students: snap.docs.map(d => ({ id: d.id, ...d.data() })) };
};
export const deleteStudent = async (id: string) => {
  const userId = getUserId();
  if (!userId) return { success: false, error: 'No user' };
  await firestore().collection('users').doc(userId).collection('students').doc(id).delete();
  return { success: true };
};