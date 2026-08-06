/**
 * FILE: src/screens/SplashScreen.tsx
 * ROLE: App gatekeeper — downloads/caches the full Quran into SQLite on first
 *       launch, seeds the surah-name map into Redux, then routes to Dashboard or
 *       Login based on Firebase auth state.
 * DEPENDS ON: src/database/quranData.ts (downloadAndCacheQuran, getSurahs),
 *             src/store/quranSlice.ts (setSurahNames), @react-native-firebase/auth,
 *             react-redux (useDispatch)
 * USED BY: registered as stack screen "Splash" in App.tsx:103 (initialRouteName,
 *          App.tsx:101); the only entry screen of the app
 */
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

  /**
   * WHAT: Full startup sequence: download+verify the Quran DB, load surah names
   *       into Redux, then wait for Firebase auth and navigate away.
   * FLOW: 1) setIsLoading(true), setError(false) — line 15
   *       2) await downloadAndCacheQuran() — seeds SQLite (verses/surahs/
   *          mushaf_pages); idempotent verse-count check; does NOT throw on
   *          partial completion (MIN_USABLE_VERSES path)
   *       3) await getSurahs() — SELECT * FROM surahs ORDER BY id
   *       4) Build map = {surah.id: surah.englishName}, dispatch setSurahNames(map)
   *       5) Subscribe auth().onAuthStateChanged — fires once with the restored
   *          session, then unsubscribes
   *       6) navigation.replace(user ? 'Dashboard' : 'Login') — replace (not
   *          navigate) so Splash is removed from the back stack
   *       7) On thrown error: setError(true) + errorMessage, setIsLoading(false);
   *          retry screen shown, auth listener never runs
   * CALLS: downloadAndCacheQuran -> initDatabase, verse count, fetchMissing +
   *        fetchMushafPages; getSurahs; dispatch(setSurahNames);
   *        auth().onAuthStateChanged
   * CALLED BY: useEffect on mount (line 30) and "Retry Download" button onPress
   *            (line 44)
   * AFFECTS: SQLite (verses, surahs, mushaf_pages), quranSlice.surahNames,
   *          navigation stack (Splash -> Dashboard/Login)
   * NOTES: Route decision happens ONLY inside the onAuthStateChanged callback —
   *        if steps 2-4 throw, the listener is never subscribed and the app
   *        stays on the retry screen. No dispatch(setUser) here: on cold start
   *        redux auth is rehydrated from AsyncStorage (persistConfig whitelist),
   *        but a stale/expired session is still caught by onAuthStateChanged —
   *        the Firebase session is the source of truth, not the Redux flag.
   */
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

  /**
   * WHAT: Runs the full load sequence exactly once on mount.
   * FLOW: 1) Called after first render; load is recreated only when navigation
   *          or dispatch changes (useCallback deps), so the effect fires once.
   * CALLS: load
   * CALLED BY: React on component mount
   * AFFECTS: kicks off DB download + auth routing
   */
  useEffect(() => { load(); }, [load]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Teach Quran</Text>
      {isLoading ? (
        <>
          <Text style={styles.subtitle}>Downloading Quran Data...</Text>
          <ActivityIndicator size="large" color="#00d4aa" style={{ marginTop: 20 }} />
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
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 20, color: '#00d4aa' },
  subtitle: { fontSize: 16, color: '#888' },
  errorText: { fontSize: 18, color: '#ff4444', textAlign: 'center', marginBottom: 10, fontWeight: 'bold' },
  errorBox: { maxHeight: 200, width: '100%', backgroundColor: '#1e1e1e', borderRadius: 8, padding: 10, marginBottom: 20 },
  errorDetail: { fontSize: 12, color: '#fff' },
  retryBtn: { backgroundColor: '#00d4aa', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 8 },
  retryText: { color: '#121212', fontSize: 16, fontWeight: '700' }
});
