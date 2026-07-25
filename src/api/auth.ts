import { auth, firestore, formatUsernameToEmail } from './firebase';
export const registerUser = async (username: string, password: string) => {
  try {
    const email = formatUsernameToEmail(username);
    const userCredential = await auth().createUserWithEmailAndPassword(email, password);
    await firestore().collection('users').doc(userCredential.user.uid).set({ username, createdAt: firestore.FieldValue.serverTimestamp() });
    return { success: true, user: userCredential.user };
  } catch (error: any) { return { success: false, error: error.message }; }
};
export const loginUser = async (username: string, password: string) => {
  try {
    const email = formatUsernameToEmail(username);
    const userCredential = await auth().signInWithEmailAndPassword(email, password);
    return { success: true, user: userCredential.user };
  } catch (error: any) { return { success: false, error: error.message }; }
};
export const logoutUser = async () => { await auth().signOut(); };