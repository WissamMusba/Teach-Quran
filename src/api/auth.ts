import { auth, firestore, formatUsernameToEmail } from './firebase';

const mapFirebaseError = (error: any): string => {
  const code = error?.code || error?.message || '';
  if (code.includes('user-not-found')) return 'Username not found. Please check your spelling.';
  if (code.includes('wrong-password')) return 'Incorrect password. Please try again.';
  if (code.includes('email-already-in-use')) return 'This username is already taken.';
  if (code.includes('too-many-requests')) return 'Too many attempts. Please try again later.';
  if (code.includes('invalid-email')) return 'Invalid username format.';
  if (code.includes('weak-password')) return 'Password must be at least 6 characters.';
  if (code.includes('network-request-failed')) return 'Network error. Check your connection.';
  if (code.includes('user-disabled')) return 'This account has been disabled.';
  if (code.includes('invalid-credential')) return 'Invalid username or password.';
  return error?.message || 'An unexpected error occurred.';
};

export const registerUser = async (username: string, password: string) => {
  try {
    const email = formatUsernameToEmail(username);
    const userCredential = await auth().createUserWithEmailAndPassword(email, password);
    await firestore().collection('users').doc(userCredential.user.uid).set({ username, createdAt: firestore.FieldValue.serverTimestamp() });
    return { success: true, user: userCredential.user };
  } catch (error: any) { return { success: false, error: mapFirebaseError(error) }; }
};
export const loginUser = async (username: string, password: string) => {
  try {
    const email = formatUsernameToEmail(username);
    const userCredential = await auth().signInWithEmailAndPassword(email, password);
    return { success: true, user: userCredential.user };
  } catch (error: any) { return { success: false, error: mapFirebaseError(error) }; }
};
export const logoutUser = async () => { await auth().signOut(); };