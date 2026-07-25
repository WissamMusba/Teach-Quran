import { firestore } from './firebase';
import auth from '@react-native-firebase/auth';
import type { StudentResponse, Student } from '../utils/types';
import { getCachedStudentList, cacheStudentList } from '../database/localDB';
export const createStudent = async (name: string): Promise<StudentResponse> => {
  const user = auth().currentUser;
  if (!user) return { success: false, error: 'Not authenticated' };
  const ref = await firestore().collection('users').doc(user.uid).collection('students').add({ name, createdAt: firestore.FieldValue.serverTimestamp() });
  await ref.collection('data').doc('studentData').set({ bookmarks: {}, highlights: {}, drawings: {}, notes: {} });
  return { success: true, studentId: ref.id };
};
async function refreshInBackground(uid: string) {
  try { const snap = await firestore().collection('users').doc(uid).collection('students').orderBy('createdAt', 'desc').get(); await cacheStudentList(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))); } catch {}
}
export const getStudents = async (): Promise<StudentResponse> => {
  const user = auth().currentUser;
  if (!user) return { success: false, error: 'Not authenticated' };
  try {
    const cached = await getCachedStudentList();
    if (cached && cached.length > 0) { refreshInBackground(user.uid); return { success: true, students: cached }; }
    const snap = await firestore().collection('users').doc(user.uid).collection('students').orderBy('createdAt', 'desc').get();
    const students: Student[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
    await cacheStudentList(students);
    return { success: true, students };
  } catch (e: any) {
    const cached = await getCachedStudentList();
    if (cached && cached.length > 0) return { success: true, students: cached };
    return { success: false, error: e.message };
  }
};
export const deleteStudent = async (id: string): Promise<StudentResponse> => {
  const user = auth().currentUser;
  if (!user) return { success: false, error: 'Not authenticated' };
  await firestore().collection('users').doc(user.uid).collection('students').doc(id).delete();
  return { success: true };
};