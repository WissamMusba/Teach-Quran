import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
firestore().settings({ persistence: true });
export const usernameToEmail = (username: string): string => {
  const s = username.toLowerCase().trim().replace(/[^a-z0-9._-]/g, '.').replace(/\.+/g, '.').replace(/^\.|\.$/g, '');
  if (!s || s.length < 3) throw new Error('Username must be at least 3 alphanumeric characters.');
  return `${s}@quranmaster.app`;
};
export { auth, firestore };
export const getUserId = () => auth().currentUser ? auth().currentUser.uid : null;