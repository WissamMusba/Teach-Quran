import React, { useEffect, useState } from 'react';
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

  useEffect(() => {
    let isMounted = true; // ⚠️ CRITICAL FIX: Prevent state updates on unmounted component

    const load = async () => {
      setIsLoading(true);
      setError(false);
      
      try {
        await downloadAndCacheQuran();

        // ⚠️ FIX: Fetch surah names AFTER database is ready
        const surahs = await getSurahs();
        const map = {} as any;
        surahs.forEach((s: any) => map[s.id] = s.englishName);
        dispatch(setSurahNames(map));

        // ⚠️ CRITICAL FIX: Clean up listener properly
        const unsub = auth().onAuthStateChanged(user => {
          if (!isMounted) {
            unsub();
            return;
          }
          navigation.replace(user ? 'Dashboard' : 'Login');
          unsub();
        });
      } catch (e: any) {
        if (!isMounted) return;
        console.error('Splash Screen Error:', e);
        setError(true);
        setErrorMessage(e.message || JSON.stringify(e));
        setIsLoading(false);
      }
    };

    load();

    return () => { isMounted = false; };
  }, [navigation]);

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
          <ScrollView style={styles.errorBox}>
            <Text style={styles.errorDetail}>{errorMessage}</Text>
          </ScrollView>
          {/* Retry button will be handled by user reloading app or a separate trigger if needed */}
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
});