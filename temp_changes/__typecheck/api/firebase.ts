/**
 * FILE: src/api/firebase.ts
 * ROLE: Tiny module that re-exports the Firebase Auth + Firestore instances and
 *       provides the username<->email mapping and current-user-id helpers.
 * DEPENDS ON: Firebase native modules (google-services.json, android/app)
 * USED BY: src/api/auth.ts (auth/firestore/formatUsernameToEmail),
 *          src/api/student.ts (firestore/getUserId),
 *          src/api/sync.ts (firestore/getUserId)
 */
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
/**
 * WHAT: Converts a plain username into the deterministic Firebase Auth email
 *       `sanitized@quranmaster.app` (lowercased, non-alphanumeric chars stripped).
 * FLOW: 1) Lowercase the input. 2) Strip anything outside [a-z0-9] with regex.
 *       3) Append the fixed domain @quranmaster.app.
 * CALLS: (none — pure string transform)
 * CALLED BY: auth.ts registerUser -> createUserWithEmailAndPassword,
 *            auth.ts loginUser -> signInWithEmailAndPassword
 * AFFECTS: Determines the Firebase Auth account key; any username resolving to
 *          the same email collides (e.g. "A1" vs "a1" vs "a-1").
 * NOTES: NOT reversible — original username is only stored in the Firestore
 *        users doc, never in Firebase Auth. Usernames with spaces/symbols map
 *        to the same email; the client does no uniqueness pre-check besides
 *        the email-already-in-use error.
 */
export const formatUsernameToEmail = (username: string) => `${username.toLowerCase().replace(/[^a-z0-9]/g, '')}@quranmaster.app`;
import storage from '@react-native-firebase/storage';
/**
 * WHAT: Re-exported module singletons so the rest of the app never imports the
 *       SDK directly for these two services.
 * CALLED BY: auth.ts (auth/firestore), student.ts (firestore), sync.ts (firestore).
 *            SplashScreen.tsx and localDB.ts import the SDK DIRECTLY (auth) —
 *            bypassing this module. See NOTES.
 * AFFECTS: Every Firebase read/write in the app.
 * NOTES: Bypass inconsistency: SplashScreen.tsx and localDB.ts import
 *        @react-native-firebase/auth directly instead of via this file, so
 *        this module does NOT own the auth singleton as its name implies.
 */
export { auth, firestore, storage };
/**
 * WHAT: Returns the current Firebase user's uid, or null when signed out.
 * FLOW: 1) Check auth().currentUser exists. 2) Return uid or null.
 * CALLS: auth().currentUser -> Firebase session
 * CALLED BY: student.ts (auth guard before CRUD), sync.ts (auth guard before syncing)
 * AFFECTS: Null short-circuits every API call with { success:false, error:'No
 *          user' } — the de-facto offline/anon guard for the API layer.
 * NOTES: Synchronous read of the cached session; does not wait for
 *        onAuthStateChanged. Called before any Firestore path is built, so the
 *        uid is never undefined in a path.
 */
export const getUserId = () => auth().currentUser ? auth().currentUser.uid : null;