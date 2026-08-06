/**
 * FILE: src/screens/RegisterScreen.tsx
 * ROLE: Account creation form; validates, creates Firebase user + Firestore user
 *       doc, shows a success dialog, then sends the user back to Login.
 * DEPENDS ON: src/api/auth.ts (registerUser), src/components/common/AlertModal.tsx
 * USED BY: registered as stack screen "Register" in App.tsx:107; navigated to
 *          from LoginScreen.tsx:39 ("Create Account" link)
 */
import React, { useState, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import { registerUser } from '../api/auth'
import AlertModal from '../components/common/AlertModal'

export default function RegisterScreen({ navigation }: any) {
  const [u, setU] = useState('')
  const [p, setP] = useState('')
  const [showP, setShowP] = useState(false)
  const [loading, setLoading] = useState(false)
  const [alert, setAlert] = useState({ visible: false, title: '', message: '', isSuccess: false })

  /**
   * WHAT: Validates username/password, creates the Firebase account + Firestore
   *       profile, and reports success or a mapped error.
   * FLOW: 1) Reject while a registration is already in flight (loading guard).
   *       2) Empty username or password -> AlertModal error
   *       3) password < 6 chars -> AlertModal "Password must be at least 6
   *          characters." (mirrors firebase weak-password message)
   *       4) setLoading(true); const res = await registerUser(u.trim(), p) —
   *          formatUsernameToEmail -> createUserWithEmailAndPassword ->
   *          firestore().collection('users').doc(uid).set({username, createdAt:
   *          serverTimestamp()}); staged auth.ts rolls back the auth user when
   *          the profile write fails and signs out the auto-created session so
   *          registration never auto-logins. registerUser never throws by
   *          contract, but the try/catch/finally guarantees the spinner
   *          cannot stay stuck on an unexpected rejection and surfaces it.
   *       5) success -> AlertModal "Account created! You can now log in." with
   *          isSuccess flag; navigation to Login happens via the dialog's
   *          "Log In" button and/or onClose
   *       6) failure -> AlertModal "Registration Failed" with res.error
   *       7) finally: setLoading(false) — runs on every path
   * CALLS: registerUser -> formatUsernameToEmail ->
   *        auth().createUserWithEmailAndPassword ->
   *        firestore().collection('users').doc(uid).set(...);
   *        navigation.navigate('Login') -> back to login (never auto-logins-in)
   * CALLED BY: "Register" button onPress
   * AFFECTS: Firebase Auth users collection; Firestore users/{uid} profile doc;
   *          navigation stack (Register -> Login)
   * NOTES: Registration does NOT auto-login — the user must sign in on the
   *        Login screen (deliberate design; staged auth.ts signs out the
   *        createUserWithEmailAndPassword auto-session before returning).
   *        Usernames are sanitized to [a-z0-9] and lowercased, so "Ahmed_1"
   *        and "ahmed1" collide (formatUsernameToEmail, firebase.ts:3).
   *        AlertModal fires btn.onPress() then onClose() (AlertModal.tsx:68),
   *        so on success BOTH the button handler and onClose navigate('Login')
   *        — the second navigate is a harmless no-op but a double-navigation
   *        code smell. isSuccess is never reset after setAlert(visible:false)
   *        — harmless because visible gates it. "Back to Login" link uses
   *        navigation.goBack() while the dialog uses navigate — two different
   *        unwinding paths.
   */
  const handleReg = useCallback(async () => {
    if (loading) return
    if (!u.trim() || !p.trim()) { setAlert({ visible: true, title: 'Error', message: 'Please enter both username and password.', isSuccess: false }); return }
    if (p.length < 6) { setAlert({ visible: true, title: 'Error', message: 'Password must be at least 6 characters.', isSuccess: false }); return }
    setLoading(true)
    try {
      const res = await registerUser(u.trim(), p)
      if (res.success) { setAlert({ visible: true, title: 'Success', message: 'Account created! You can now log in.', isSuccess: true }) }
      else setAlert({ visible: true, title: 'Registration Failed', message: res.error, isSuccess: false })
    } catch (e: any) {
      setAlert({ visible: true, title: 'Registration Failed', message: e?.message || 'An unexpected error occurred.', isSuccess: false })
    } finally {
      setLoading(false)
    }
  }, [u, p, loading, navigation])

  return (
    // KeyboardAvoidingView: iOS does not resize the window for the keyboard, so
    // the centered form (and its Register button) can sit under the keyboard;
    // padding lifts it. Android relies on windowSoftInputMode="adjustResize"
    // (AndroidManifest.xml) and needs no behavior.
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.title}>Create Account</Text>
      <TextInput style={styles.input} placeholder="Username" placeholderTextColor="#666" onChangeText={setU} autoCapitalize="none" />
      <View style={styles.pwRow}>
        <TextInput style={styles.pwInput} placeholder="Password (6+ chars)" placeholderTextColor="#666" onChangeText={setP} secureTextEntry={!showP} />
        <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowP(!showP)} activeOpacity={0.6}>
          <View style={styles.eyeIconWrap}>
            <Text style={styles.eyeIcon}>👁</Text>
            {!showP && <View style={styles.eyeSlash} />}
          </View>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.btn} onPress={handleReg} disabled={loading} activeOpacity={0.7}>
        {loading ? <ActivityIndicator color="#121212" /> : <Text style={styles.btnText}>Register</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}><Text style={styles.link}>Back to Login</Text></TouchableOpacity>
      <AlertModal visible={alert.visible} title={alert.title} message={alert.message}
        buttons={alert.isSuccess ? [{ text: 'Log In', onPress: () => navigation.navigate('Login') }] : undefined}
        onClose={() => { setAlert({ ...alert, visible: false }); if (alert.isSuccess) navigation.navigate('Login') }} />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#121212' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 30, textAlign: 'center', color: '#00d4aa' },
  input: { height: 50, borderWidth: 1, borderColor: '#333', borderRadius: 8, marginBottom: 15, paddingHorizontal: 15, color: '#fff', backgroundColor: '#1e1e1e' },
  pwRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#333', borderRadius: 8, marginBottom: 15, backgroundColor: '#1e1e1e' },
  pwInput: { flex: 1, height: 50, paddingHorizontal: 15, color: '#fff' },
  eyeBtn: { paddingHorizontal: 12, height: 50, justifyContent: 'center' },
  eyeIconWrap: { width: 26, height: 26, justifyContent: 'center', alignItems: 'center' },
  eyeIcon: { fontSize: 22, color: '#00d4aa' },
  eyeSlash: { position: 'absolute', width: '140%', height: 2, backgroundColor: '#ff4444', transform: [{ rotate: '-45deg' }] },
  btn: { height: 50, backgroundColor: '#00d4aa', justifyContent: 'center', alignItems: 'center', borderRadius: 8, marginTop: 5 },
  btnText: { color: '#121212', fontSize: 18, fontWeight: '700' },
  link: { color: '#00d4aa', marginTop: 15, textAlign: 'center', fontSize: 14 }
})
