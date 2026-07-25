import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loginUser } from '../api/auth';
import { COLORS, SPACING, RADIUS, scaleFont } from '../utils/theme';
export default function LoginScreen({ navigation }: any) {
  const [u, setU] = useState(''); const [p, setP] = useState(''); const [loading, setLoading] = useState(false);
  const handleLogin = async () => { if (!u.trim()) { Alert.alert('Error', 'Please enter your username.'); return; } if (!p || p.length < 6) { Alert.alert('Error', 'Password must be at least 6 characters.'); return; } setLoading(true); try { const res = await loginUser(u.trim(), p); if (res.success) navigation.replace('Dashboard'); else Alert.alert('Login Failed', res.error || 'Invalid credentials.'); } catch (e: any) { Alert.alert('Error', e.message || 'Something went wrong.'); } finally { setLoading(false); } };
  return (
    <SafeAreaView style={styles.container}><KeyboardAvoidingView style={styles.inner} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.logoArea}><Text style={styles.logoIcon}>📖</Text><Text style={styles.title}>Teach Quran</Text><Text style={styles.subtitle}>Quran teaching companion</Text></View>
      <View style={styles.form}>
        <TextInput style={styles.input} value={u} onChangeText={setU} placeholder="Username" placeholderTextColor={COLORS.textMuted} autoCapitalize="none" autoCorrect={false} />
        <TextInput style={styles.input} value={p} onChangeText={setP} placeholder="Password" placeholderTextColor={COLORS.textMuted} secureTextEntry />
        <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleLogin} disabled={loading} activeOpacity={0.8}>{loading ? <ActivityIndicator color={COLORS.bgDark} /> : <Text style={styles.btnText}>Login</Text>}</TouchableOpacity>
      </View>
      <TouchableOpacity onPress={() => navigation.navigate('Register')} style={styles.registerLink}><Text style={styles.registerText}>Don't have an account? <Text style={styles.registerHighlight}>Register</Text></Text></TouchableOpacity>
    </KeyboardAvoidingView></SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgDark }, inner: { flex: 1, justifyContent: 'center', padding: SPACING.xxl },
  logoArea: { alignItems: 'center', marginBottom: SPACING.xxxl }, logoIcon: { fontSize: 64, marginBottom: SPACING.lg },
  title: { fontSize: scaleFont(32), fontWeight: '800', color: COLORS.textPrimary }, subtitle: { fontSize: scaleFont(15), color: COLORS.textSecondary, marginTop: SPACING.xs },
  form: { gap: SPACING.lg },
  input: { height: 54, borderWidth: 1, borderColor: COLORS.borderDark, borderRadius: RADIUS.md, paddingHorizontal: SPACING.xl, color: COLORS.textPrimary, backgroundColor: COLORS.bgCard, fontSize: scaleFont(16) },
  btn: { height: 54, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', borderRadius: RADIUS.md, marginTop: SPACING.sm },
  btnDisabled: { opacity: 0.6 }, btnText: { color: COLORS.bgDark, fontSize: scaleFont(17), fontWeight: '700' },
  registerLink: { alignItems: 'center', marginTop: SPACING.xxl }, registerText: { color: COLORS.textSecondary, fontSize: scaleFont(15) }, registerHighlight: { color: COLORS.primary, fontWeight: '700' },
});
