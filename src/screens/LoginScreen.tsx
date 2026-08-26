/**
 * FILE: src/screens/LoginScreen.tsx
 * ROLE: Email/password (username-derived) login form; validates, calls Firebase
 *       via api/auth.ts, writes the user into Redux and replaces to Dashboard.
 * DEPENDS ON: src/api/auth.ts (loginUser), src/store/authSlice.ts (setUser),
 *             src/components/common/AlertModal.tsx, react-redux (useDispatch)
 * USED BY: registered as stack screen "Login" in App.tsx:105; target of
 *          SplashScreen.tsx:22 (unauthenticated) and RegisterScreen.tsx:35-36;
 *          reached via Dashboard logout (DashboardScreen.tsx:80)
 */
import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { loginUser } from '../api/auth';
import { setUser } from '../store/authSlice';
import { startTutorial } from '../tutorial/tutorialRuntime';
import { store } from '../store';
import AlertModal from '../components/common/AlertModal';
import CollapsibleBannerAd from '../components/ads/CollapsibleBannerAd';
export default function LoginScreen({ navigation }: any) {
  const [u, setU] = useState(''); const [p, setP] = useState(''); const [showP, setShowP] = useState(false); const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ visible: false, title: '', message: '' });
  const dispatch = useDispatch();
  const nightMode = useSelector((s: any) => s.settings.nightMode);
  const isDark = !!nightMode;

  /**
   * WHAT: Validates non-empty credentials, calls Firebase auth, and either
   *       enters the app or shows the mapped error.
   * FLOW: 1) Client-side guard: empty username or password -> AlertModal
   *          "Please enter both username and password." and return (line 12)
   *       2) setLoading(true) -> spinner replaces the button label
   *       3) const res = await loginUser(u.trim(), p) — auth.ts: formatUsernameToEmail
   *          (lowercased, non-alphanumerics stripped, + "@quranmaster.app") then
   *          signInWithEmailAndPassword; Firebase errors mapped to friendly text
   *       4) setLoading(false)
   *       5) success -> dispatch(setUser({id: res.user.uid, username: u.trim()}))
   *          then navigation.replace('Dashboard') — authSlice sets
   *          isAuthenticated = !!payload
   *       6) failure -> AlertModal "Login Failed" with res.error
   * CALLS: loginUser -> formatUsernameToEmail -> auth().signInWithEmailAndPassword;
   *        dispatch(setUser) -> authSlice reducer
   * CALLED BY: "Login" button onPress (line 36)
   * AFFECTS: authSlice.user / authSlice.isAuthenticated; navigation stack
   *          (Login -> Dashboard via replace); App.tsx:31-56 side effect re-runs
   *          on isAuthenticated change (initial sync + interval + AppState listener)
   * NOTES: Navigation happens regardless of redux state — route is driven by
   *        this dispatch, not a watcher. `res.user.uid` is duplicated by
   *        getUserId() (firebase.ts:5) reading auth().currentUser directly —
   *        the stored redux user is mostly cosmetic. loginUser never throws;
   *        all failures come back as {success:false, error}. Password is sent
   *        untrimmed while username is trimmed.
   */
  const handleLogin = useCallback(async () => {
    if (!u.trim() || !p.trim()) { setAlert({ visible: true, title: 'Error', message: 'Please enter both username and password.' }); return; }
    setLoading(true);
    const res = await loginUser(u.trim(), p);
    setLoading(false);
    if (res.success) {
      dispatch(setUser({ id: res.user.uid, username: u.trim() }));
      // v97.1: first-login walkthrough (skipped once settings.tutorialDone is set).
      if (!store.getState().settings.tutorialDone) dispatch(startTutorial());
      navigation.replace('Dashboard');
    } else {
      setAlert({ visible: true, title: 'Login Failed', message: res.error });
    }
  }, [u, p, navigation]);
  return (
    <View style={[styles.root, isDark && dark.root]}>
      <View style={[styles.container, isDark && dark.container]}>
        <Text style={[styles.title, isDark && dark.title]}>Teach Quran</Text>
        <TextInput style={[styles.input, isDark && dark.input]} placeholder="Username" placeholderTextColor={isDark ? '#8a8a8a' : '#9a9a9a'} onChangeText={setU} autoCapitalize="none" />
        <View style={[styles.pwRow, isDark && dark.pwRow]}>
          <TextInput style={[styles.pwInput, isDark && dark.pwInput]} placeholder="Password" placeholderTextColor={isDark ? '#8a8a8a' : '#9a9a9a'} onChangeText={setP} secureTextEntry={!showP} />
          <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowP(!showP)} activeOpacity={0.6}>
            <View style={styles.eyeIconWrap}>
              <Text style={[styles.eyeIcon, isDark && dark.eyeIcon]}>👁</Text>
              {!showP && <View style={styles.eyeSlash} />}
            </View>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading} activeOpacity={0.7}>
          {loading ? <ActivityIndicator color='#F8F9FA' /> : <Text style={styles.btnText}>Login</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Register')} activeOpacity={0.7}><Text style={[styles.link, isDark && dark.link]}>Create Account</Text></TouchableOpacity>
        <AlertModal visible={alert.visible} title={alert.title} message={alert.message} onClose={() => setAlert({ ...alert, visible: false })} />
      </View>
      <CollapsibleBannerAd />
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F9FA' },
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#F8F9FA' },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 30, textAlign: 'center', color: '#1C3D72' },
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
