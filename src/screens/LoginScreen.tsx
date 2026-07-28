import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useDispatch } from 'react-redux';
import { loginUser } from '../api/auth';
import { setUser } from '../store/authSlice';
import AlertModal from '../components/common/AlertModal';
export default function LoginScreen({ navigation }: any) {
  const [u, setU] = useState(''); const [p, setP] = useState(''); const [showP, setShowP] = useState(false); const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ visible: false, title: '', message: '' });
  const dispatch = useDispatch();
  const handleLogin = useCallback(async () => {
    if (!u.trim() || !p.trim()) { setAlert({ visible: true, title: 'Error', message: 'Please enter both username and password.' }); return; }
    setLoading(true);
    const res = await loginUser(u.trim(), p);
    setLoading(false);
    if (res.success) {
      dispatch(setUser({ id: res.user.uid, username: u.trim() }));
      navigation.replace('Dashboard');
    } else {
      setAlert({ visible: true, title: 'Login Failed', message: res.error });
    }
  }, [u, p, navigation]);
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Teach Quran</Text>
      <TextInput style={styles.input} placeholder="Username" placeholderTextColor="#666" onChangeText={setU} autoCapitalize="none" />
      <View style={styles.pwRow}>
        <TextInput style={styles.pwInput} placeholder="Password" placeholderTextColor="#666" onChangeText={setP} secureTextEntry={!showP} />
        <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowP(!showP)} activeOpacity={0.6}>
          <View style={styles.eyeIconWrap}>
            <Text style={styles.eyeIcon}>👁</Text>
            {!showP && <View style={styles.eyeSlash} />}
          </View>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading} activeOpacity={0.7}>
        {loading ? <ActivityIndicator color="#121212" /> : <Text style={styles.btnText}>Login</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Register')} activeOpacity={0.7}><Text style={styles.link}>Create Account</Text></TouchableOpacity>
      <AlertModal visible={alert.visible} title={alert.title} message={alert.message} onClose={() => setAlert({ ...alert, visible: false })} />
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#121212' },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 30, textAlign: 'center', color: '#00d4aa' },
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
});
