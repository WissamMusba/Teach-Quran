import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { registerUser } from '../api/auth';
export default function RegisterScreen({ navigation }: any) {
  const [u, setU] = useState(''); const [p, setP] = useState('');
  const handleReg = async () => {
    const res = await registerUser(u, p);
    if (res.success) { Alert.alert('Success', 'Account created!'); navigation.navigate('Login'); }
    else Alert.alert('Error', res.error);
  };
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>
      <TextInput style={styles.input} placeholder="Username" onChangeText={setU} autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="Password" onChangeText={setP} secureTextEntry />
      <TouchableOpacity style={styles.btn} onPress={handleReg}><Text style={styles.btnText}>Register</Text></TouchableOpacity>
    </View>
  );
}
const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', padding: 20 }, title: { fontSize: 28, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' }, input: { height: 50, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, marginBottom: 15, paddingHorizontal: 15 }, btn: { height: 50, backgroundColor: '#00CC00', justifyContent: 'center', alignItems: 'center', borderRadius: 8 }, btnText: { color: '#fff', fontSize: 18 } });