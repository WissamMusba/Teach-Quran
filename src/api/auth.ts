/**
 * FILE: src/api/auth.ts
 * ROLE: Auth API: register/login/logout against Firebase Auth, Firestore user
 *       doc creation, and Firebase error -> friendly message mapping.
 * DEPENDS ON: src/api/firebase.ts (auth/firestore singletons, formatUsernameToEmail)
 * USED BY: src/screens/RegisterScreen.tsx (registerUser),
 *          src/screens/LoginScreen.tsx (loginUser),
 *          src/screens/DashboardScreen.tsx (logoutUser)
 */
import { auth, firestore, formatUsernameToEmail } from './firebase';
import { ensureMyQuranStudent } from './student';

/**
 * WHAT: Translates Firebase error codes into user-friendly copy.
 * FLOW: 1) Read error.code ?? error.message. 2) substring-match known codes
 *       (user-not-found, wrong-password, email-already-in-use,
 *       too-many-requests, invalid-email, weak-password,
 *       network-request-failed, user-disabled, invalid-credential).
 *       3) Fall back to raw message.
 * CALLS: (none)
 * CALLED BY: registerUser catch, loginUser catch (this file)
 * AFFECTS: Error strings surfaced in LoginScreen/RegisterScreen AlertModals.
 * NOTES: Module-private — NOT exported. Keep private on rebuild.
 *        Substring matching (code.includes) is loose — e.g.
 *        "auth/email-already-in-use-2" still matches. v17.x codes like
 *        invalid-credential are covered.
 */
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

/**
 * WHAT: Creates a Firebase Auth account from a username + password and seeds the
 *       matching Firestore users/{uid} profile doc.
 * FLOW: 1) Derive email = formatUsernameToEmail(username).
 *       2) auth().createUserWithEmailAndPassword(email, password).
 *       3) firestore().collection('users').doc(uid).set({ username, createdAt:
 *          serverTimestamp() }) — the ONLY place users/{uid} is written.
 *       4) Return { success:true, user } or { success:false, error } via
 *          mapFirebaseError.
 * CALLS: formatUsernameToEmail -> build Auth email (firebase.ts)
 *        auth().createUserWithEmailAndPassword -> create Firebase Auth account
 *        firestore().collection('users').doc(uid).set -> create profile doc
 *        firestore.FieldValue.serverTimestamp -> trusted creation time
 * CALLED BY: RegisterScreen.tsx handleReg -> on Register press; shows success
 *            alert, then user navigates to Login manually.
 * AFFECTS: Cloud: users/{uid} doc {username, createdAt}.
 *          Redux: NOTHING — registerUser does not dispatch setUser; the user is
 *          NOT auto-logged-in and RegisterScreen never touches authSlice.
 * NOTES: No client-side trim enforcement inside (caller trims). No try/catch
 *        around the Firestore set — if the profile write fails after a
 *        successful Auth creation, registerUser still returns success but the
 *        users doc is missing (partial account). Firebase rule for users/{uid}
 *        must allow create or registration breaks — no firestore.rules file in
 *        repo (console-managed).
 */
export const registerUser = async (username: string, password: string) => {
  try {
    const email = formatUsernameToEmail(username);
    const userCredential = await auth().createUserWithEmailAndPassword(email, password);
    await firestore().collection('users').doc(userCredential.user.uid).set({ username, createdAt: firestore.FieldValue.serverTimestamp() });
    try { await ensureMyQuranStudent(); } catch {}
    return { success: true, user: userCredential.user };
  } catch (error: any) { return { success: false, error: mapFirebaseError(error) }; }
};
/**
 * WHAT: Signs an existing user in with the derived email.
 * FLOW: 1) Derive email = formatUsernameToEmail(username).
 *       2) auth().signInWithEmailAndPassword(email, password).
 *       3) Return { success:true, user } or mapped error.
 * CALLS: formatUsernameToEmail -> build Auth email (firebase.ts)
 *        auth().signInWithEmailAndPassword -> Firebase Auth sign-in
 * CALLED BY: LoginScreen.tsx handleLogin -> on Login press; on success the
 *            screen dispatches setUser({id: uid, username}) itself and
 *            navigation.replace('Dashboard').
 * AFFECTS: Redux: indirectly — authSlice.user/isAuthenticated set by
 *          LoginScreen, NOT by this function. This mismatch (Redux session vs
 *          Firebase session) gates App.tsx's sync effect on the Redux flag only.
 * NOTES: Legacy v17.x credential APIs: signInWithEmailAndPassword still works
 *        in @react-native-firebase/auth 17.5.0. Errors (user-not-found,
 *        invalid-credential) are remapped to "Username not found." etc.
 */
export const loginUser = async (username: string, password: string) => {
  try {
    const email = formatUsernameToEmail(username);
    const userCredential = await auth().signInWithEmailAndPassword(email, password);
    return { success: true, user: userCredential.user };
  } catch (error: any) { return { success: false, error: mapFirebaseError(error) }; }
};
/**
 * WHAT: Signs the Firebase Auth session out (Firebase-side only).
 * FLOW: 1) auth().signOut().
 * CALLS: auth().signOut() -> destroy Firebase session
 * CALLED BY: DashboardScreen.tsx logout button onPress -> which then dispatches
 *            logout() (authSlice) and navigation.replace('Login').
 * AFFECTS: Firebase session; Redux is cleared by the caller's logout()
 *          dispatch (authSlice) — which in turn stops App.tsx's sync
 *          interval/AppState triggers (they check isAuthenticated).
 *          SQLite caches are NOT cleared on logout (per-uid cache keys make
 *          this safe).
 * NOTES: Not awaited in a try/catch at the call site — a failed signOut
 *        rejects the promise but the Redux logout + navigation still run.
 */
export const logoutUser = async () => { await auth().signOut(); };