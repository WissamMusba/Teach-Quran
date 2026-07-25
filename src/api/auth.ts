import type { AuthResponse } from '../utils/types';
import { auth, firestore, usernameToEmail } from './firebase';
export const registerUser = async (username: string, password: string): Promise<AuthResponse> => {
  try {
    const email = usernameToEmail(username);
    const userCredential = await auth().createUserWithEmailAndPassword(email, password);
    await firestore().collection('users').doc(userCredential.user.uid).set({ username, createdAt: firestore.FieldValue.serverTimestamp() });
    return { success: true, uid: userCredential.user.uid };
  } catch (error: any) { return { success: false, error: error.message }; }
};
export const loginUser = async (username: string, password: string): Promise<AuthResponse> => {
  try {
    const email = usernameToEmail(username);
    const userCredential = await auth().signInWithEmailAndPassword(email, password);
    return { success: true, uid: userCredential.user.uid };
  } catch (error: any) { return { success: false, error: error.message }; }
};
export const logoutUser = async (): Promise<void> => { await auth().signOut(); };