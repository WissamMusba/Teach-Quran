import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { downloadAndCacheQuran, getSurahs } from '../database/quranData';
import auth from '@react-native-firebase/auth';
import { useDispatch } from 'react-redux';
import { setSurahNames } from '../store/quranSlice';

export default function SplashScreen({ navigation }: any) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const dispatch = useDispatch();

  const load = useCallback(async () => {
    setIsLoading(true); setError(false);
    try {
      await downloadAndCacheQuran();
      const surahs = await getSurahs();
      const map = {}; surahs.forEach((s: any) => map[s.id] = s.englishName);
      dispatch(setSurahNames(map));
      const unsub = auth().onAuthStateChanged(user => {
        navigation.replace(user ? 'Dashboard' : 'Login');
        unsub();
      });
    } catch (e: any) {
      setError(true); setErrorMessage(e.message || JSON.stringify(e)); setIsLoading(false);
    }
  }, [navigation, dispatch]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Teach Quran</Text>
      {isLoading ? (
        <>
          <Text style={styles.subtitle}>Downloading Quran Data...</Text>
          <ActivityIndicator size="large" color="#0066FF" style={{ marginTop: 20 }} />
        </>
      ) : error ? (
        <>
          <Text style={styles.errorText}>Download failed!</Text>
          <ScrollView style={styles.errorBox}><Text style={styles.errorDetail}>{errorMessage}</Text></ScrollView>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Retry Download</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#121212' },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 20, color: '#fff' },
  subtitle: { fontSize: 16, color: '#888' },
  errorText: { fontSize: 18, color: '#FF0000', textAlign: 'center', marginBottom: 10, fontWeight: 'bold' },
  errorBox: { maxHeight: 200, width: '100%', backgroundColor: '#1e1e1e', borderRadius: 8, padding: 10, marginBottom: 20 },
  errorDetail: { fontSize: 12, color: '#fff' },
  retryBtn: { backgroundColor: '#0066FF', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 8 },
  retryText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
