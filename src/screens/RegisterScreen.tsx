/**
 * FILE: src/screens/RegisterScreen.tsx
 * ROLE: Account creation form; validates, creates Firebase user + Firestore user
 *       doc, shows a success dialog, then sends the user back to Login.
 * DEPENDS ON: src/api/auth.ts (registerUser), src/components/common/AlertModal.tsx
 * USED BY: registered as stack screen "Register" in App.tsx:107; navigated to
 *          from LoginScreen.tsx:39 ("Create Account" link)
 */
import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { registerUser } from '../api/auth';
import { useDispatch, useSelector } from 'react-redux';
import { setUser } from '../store/authSlice';
import { startTutorial } from '../tutorial/tutorialRuntime';
import { store } from '../store';
import AlertModal from '../components/common/AlertModal';
import Svg, { Path, Circle } from 'react-native-svg';
import CollapsibleBannerAd from '../components/ads/CollapsibleBannerAd';
export default function RegisterScreen({ navigation }: any) {
  const dispatch = useDispatch();
  const [u, setU] = useState(''); const [p, setP] = useState(''); const [showP, setShowP] = useState(false); const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ visible: false, title: '', message: '', isSuccess: false });
  const nightMode = useSelector((s: any) => s.settings.nightMode);
  const isDark = !!nightMode;

  /**
   * WHAT: Validates username/password, creates the Firebase account + Firestore
   *       profile, and reports success or a mapped error.
   * FLOW: 1) Empty username or password -> AlertModal error (line 9)
   *       2) password < 6 chars -> AlertModal "Password must be at least 6
   *          characters." (mirrors firebase weak-password message)
   *       3) setLoading(true); const res = await registerUser(u.trim(), p) —
   *          formatUsernameToEmail -> createUserWithEmailAndPassword ->
   *          firestore().collection('users').doc(uid).set({username, createdAt:
   *          serverTimestamp()}); throws caught and mapped
   *       4) setLoading(false)
   *       5) success -> AlertModal "Account created! You can now log in." with
   *          isSuccess flag; navigation to Login happens via the dialog's
   *          "Log In" button and/or onClose (line 35-36)
   *       6) failure -> AlertModal "Registration Failed" with res.error
   * CALLS: registerUser -> formatUsernameToEmail ->
   *        auth().createUserWithEmailAndPassword ->
   *        firestore().collection('users').doc(uid).set(...);
   *        navigation.navigate('Login') -> back to login (never auto-logins-in)
   * CALLED BY: "Register" button onPress (line 30)
   * AFFECTS: Firebase Auth users collection; Firestore users/{uid} profile doc;
   *          navigation stack (Register -> Login)
   * NOTES: Registration does NOT auto-login — the user must sign in on the
   *        Login screen (deliberate design). Usernames are sanitized to [a-z0-9]
   *        and lowercased, so "Ahmed_1" and "ahmed1" collide
   *        (formatUsernameToEmail, firebase.ts:3). AlertModal fires btn.onPress()
   *        then onClose() (AlertModal.tsx:49), so on success BOTH the button
   *        handler and onClose navigate('Login') — the second navigate is a
   *        harmless no-op but a double-navigation code smell. isSuccess is never
   *        reset after setAlert(visible:false) — harmless because visible gates it.
   *        "Back to Login" link uses navigation.goBack() while the dialog uses
   *        navigate — two different unwinding paths.
   */
  const handleReg = useCallback(async () => {
    if (!u.trim() || !p.trim()) { setAlert({ visible: true, title: 'Error', message: 'Please enter both username and password.', isSuccess: false }); return; }
    if (p.length < 6) { setAlert({ visible: true, title: 'Error', message: 'Password must be at least 6 characters.', isSuccess: false }); return; }
    setLoading(true);
    const res = await registerUser(u.trim(), p);
    setLoading(false);
    if (res.success) {
      dispatch(setUser({ id: res.user.uid, username: u.trim() }));
      if (!store.getState().settings.tutorialDone) dispatch(startTutorial());
      navigation.replace('Dashboard');
    } else setAlert({ visible: true, title: 'Registration Failed', message: res.error, isSuccess: false });
  }, [u, p, navigation]);
  return (
    <View style={[styles.root, isDark && dark.root]}>
      <View style={[styles.container, isDark && dark.container]}>
        <Text style={[styles.title, isDark && dark.title]}>Create Account</Text>
        <TextInput style={[styles.input, isDark && dark.input]} placeholder="Username" placeholderTextColor={isDark ? '#8a8a8a' : '#9a9a9a'} onChangeText={setU} autoCapitalize="none" />
        <View style={[styles.pwRow, isDark && dark.pwRow]}>
          <TextInput style={[styles.pwInput, isDark && dark.pwInput]} placeholder="Password (6+ chars)" placeholderTextColor={isDark ? '#8a8a8a' : '#9a9a9a'} onChangeText={setP} secureTextEntry={!showP} />
          <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowP(!showP)} activeOpacity={0.6}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={isDark ? '#9aa0b6' : '#5a6380'} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              {showP ? (<><Path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" /><Circle cx={12} cy={12} r={3.2} /></>) : (<><Path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" /><Circle cx={12} cy={12} r={3.2} /><Path d="M3 3l18 18" /></>)}
            </Svg>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.btn} onPress={handleReg} disabled={loading} activeOpacity={0.7}>
          {loading ? <ActivityIndicator color='#F8F9FA' /> : <Text style={styles.btnText}>Register</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}><Text style={[styles.link, isDark && dark.link]}>Back to Login</Text></TouchableOpacity>
        <AlertModal visible={alert.visible} title={alert.title} message={alert.message}
          buttons={alert.isSuccess ? [{ text: 'Log In', onPress: () => navigation.navigate('Login') }] : undefined}
          onClose={() => { setAlert({ ...alert, visible: false }); if (alert.isSuccess) navigation.navigate('Login'); }} />
      </View>
      <CollapsibleBannerAd />
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F9FA' },
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#F8F9FA' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 30, textAlign: 'center', color: '#1C3D72' },
  input: { height: 50, borderWidth: 1, borderColor: '#e0e0e4', borderRadius: 8, marginBottom: 15, paddingHorizontal: 15, color: '#1A1A1A', backgroundColor: '#ffffff' },
  pwRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e0e0e4', borderRadius: 8, marginBottom: 15, backgroundColor: '#ffffff' },
  pwInput: { flex: 1, height: 50, paddingHorizontal: 15, color: '#1A1A1A' },
  eyeBtn: { paddingHorizontal: 12, height: 50, justifyContent: 'center' },
  eyeIconWrap: { width: 26, height: 26, justifyContent: 'center', alignItems: 'center' },
  eyeIcon: { fontSize: 22, color: '#1C3D72' },
  eyeSlash: { position: 'absolute', width: '140%', height: 2, backgroundColor: '#ff4444', transform: [{ rotate: '-45deg' }] },
  btn: { height: 50, backgroundColor: '#1C3D72', justifyContent: 'center', alignItems: 'center', borderRadius: 8, marginTop: 5 },
  btnText: { color: '#F8F9FA', fontSize: 18, fontWeight: '700' },
  link: { color: '#1C3D72', marginTop: 15, textAlign: 'center', fontSize: 14 }
});
const dark = StyleSheet.create({
  root: { backgroundColor: '#1a1a2e' },
  container: { backgroundColor: '#1a1a2e' },
  title: { color: '#ffffff' },
  input: { backgroundColor: '#1a1a2e', borderColor: '#2a2a4a', color: '#ffffff' },
  pwRow: { backgroundColor: '#1a1a2e', borderColor: '#2a2a4a' },
  pwInput: { color: '#ffffff' },
  eyeIcon: { color: '#7BA7DB' },
  link: { color: '#7BA7DB' },
});
