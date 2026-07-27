import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useDispatch } from 'react-redux';
import { loginUser } from '../api/auth';
import { setUser } from '../store/authSlice';
export default function LoginScreen({ navigation }: any) {
  const [u, setU] = useState(''); const [p, setP] = useState(''); const dispatch = useDispatch();
  const handleLogin = async () => {
    const res = await loginUser(u, p);
    if (res.success) {
      dispatch(setUser({ id: res.user.uid, username: u }));
      navigation.replace('Dashboard');
    } else {
      Alert.alert('Error', res.error);
    }
  };
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Teach Quran</Text>
      <TextInput style={styles.input} placeholder="Username" placeholderTextColor="#666" onChangeText={setU} autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#666" onChangeText={setP} secureTextEntry />
      <TouchableOpacity style={styles.btn} onPress={handleLogin}><Text style={styles.btnText}>Login</Text></TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Register')}><Text style={styles.link}>Create Account</Text></TouchableOpacity>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#121212' },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 30, textAlign: 'center', color: '#00d4aa' },
  input: { height: 50, borderWidth: 1, borderColor: '#333', borderRadius: 8, marginBottom: 15, paddingHorizontal: 15, color: '#fff', backgroundColor: '#1e1e1e' },
  btn: { height: 50, backgroundColor: '#00d4aa', justifyContent: 'center', alignItems: 'center', borderRadius: 8, marginTop: 5 },
  btnText: { color: '#121212', fontSize: 18, fontWeight: '700' },
  link: { color: '#00d4aa', marginTop: 15, textAlign: 'center', fontSize: 14 }
});
