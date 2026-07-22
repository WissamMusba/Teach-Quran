import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
export const formatUsernameToEmail = (username: string) => `${username.toLowerCase().replace(/[^a-z0-9]/g, '')}@quranmaster.app`;
export { auth, firestore };
export const getUserId = () => auth().currentUser ? auth().currentUser.uid : null;