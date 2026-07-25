import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { registerUser } from '../api/auth';
import { COLORS, SPACING, RADIUS, scaleFont } from '../utils/theme';
export default function RegisterScreen({ navigation }: any) {
  const [u, setU] = useState(''); const [p, setP] = useState(''); const [p2, setP2] = useState(''); const [loading, setLoading] = useState(false);
  const handleReg = async () => { if (!u.trim()) { Alert.alert('Error', 'Please enter a username.'); return; } if (u.trim().length < 3) { Alert.alert('Error', 'Username must be at least 3 characters.'); return; } if (!p || p.length < 6) { Alert.alert('Error', 'Password must be at least 6 characters.'); return; } if (p !== p2) { Alert.alert('Error', 'Passwords do not match.'); return; } setLoading(true); try { const res = await registerUser(u.trim(), p); if (res.success) { Alert.alert('Success', 'Account created! Please login.'); navigation.navigate('Login'); } else Alert.alert('Error', res.error || 'Registration failed.'); } catch (e: any) { Alert.alert('Error', e.message || 'Something went wrong.'); } finally { setLoading(false); } };
  return (
    <SafeAreaView style={styles.container}><KeyboardAvoidingView style={styles.inner} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.logoArea}><Text style={styles.logoIcon}>✨</Text><Text style={styles.title}>Create Account</Text></View>
      <View style={styles.form}>
        <TextInput style={styles.input} value={u} onChangeText={setU} placeholder="Username (min 3 chars)" placeholderTextColor={COLORS.textMuted} autoCapitalize="none" />
        <TextInput style={styles.input} value={p} onChangeText={setP} placeholder="Password (min 6 chars)" placeholderTextColor={COLORS.textMuted} secureTextEntry />
        <TextInput style={styles.input} value={p2} onChangeText={setP2} placeholder="Confirm Password" placeholderTextColor={COLORS.textMuted} secureTextEntry />
        <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleReg} disabled={loading} activeOpacity={0.8}>{loading ? <ActivityIndicator color={COLORS.bgDark} /> : <Text style={styles.btnText}>Register</Text>}</TouchableOpacity>
      </View>
      <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginLink}><Text style={styles.loginText}>Already have an account? <Text style={styles.loginHighlight}>Login</Text></Text></TouchableOpacity>
    </KeyboardAvoidingView></SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgDark }, inner: { flex: 1, justifyContent: 'center', padding: SPACING.xxl },
  logoArea: { alignItems: 'center', marginBottom: SPACING.xxxl }, logoIcon: { fontSize: 56, marginBottom: SPACING.lg },
  title: { fontSize: scaleFont(28), fontWeight: '800', color: COLORS.textPrimary }, form: { gap: SPACING.lg },
  input: { height: 54, borderWidth: 1, borderColor: COLORS.borderDark, borderRadius: RADIUS.md, paddingHorizontal: SPACING.xl, color: COLORS.textPrimary, backgroundColor: COLORS.bgCard, fontSize: scaleFont(16) },
  btn: { height: 54, backgroundColor: COLORS.green, justifyContent: 'center', alignItems: 'center', borderRadius: RADIUS.md, marginTop: SPACING.sm },
  btnDisabled: { opacity: 0.6 }, btnText: { color: '#fff', fontSize: scaleFont(17), fontWeight: '700' },
  loginLink: { alignItems: 'center', marginTop: SPACING.xxl }, loginText: { color: COLORS.textSecondary, fontSize: scaleFont(15) }, loginHighlight: { color: COLORS.primary, fontWeight: '700' },
});
