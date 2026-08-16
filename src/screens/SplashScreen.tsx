/**
 * FILE: src/screens/SplashScreen.tsx
 * ROLE: App gatekeeper — downloads/caches the full Quran into SQLite on first
 *       launch, seeds the surah-name map into Redux, then routes to Dashboard or
 *       Login based on Firebase auth state.
 * DEPENDS ON: src/database/quranData.ts (downloadAndCacheQuran, getSurahs,
 *             warmIndopakIndexes),
 *             src/store/quranSlice.ts (setSurahNames), @react-native-firebase/auth,
 *             react-redux (useDispatch)
 * USED BY: registered as stack screen "Splash" in App.tsx:103 (initialRouteName,
 *          App.tsx:101); the only entry screen of the app
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity, ScrollView, InteractionManager } from 'react-native';
import { downloadAndCacheQuran, getSurahs, warmIndopakIndexes } from '../database/quranData';
import auth from '@react-native-firebase/auth';
import { useDispatch } from 'react-redux';
import { setSurahNames } from '../store/quranSlice';

// P1-F — single-flight guard: warmIndopakIndexes starts at most ONCE per process, and only
// after the app's own startup work has had the JS thread (InteractionManager + 2s grace — the
// Dashboard mounts and renders before the bulk indopak index build ever runs; a retry download
// must never double-start it).
let indopakWarmStarted = false;

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
   *       3) warmIndopakIndexes() fire-and-forget (.catch, NOT awaited) —
   *          pre-warms the indopak page index/verse map + SQLite bulk import
   *          so the first indopak page press never pays those multi-MB costs
   *       4) await getSurahs() — SELECT * FROM surahs ORDER BY id
   *       5) Build map = {surah.id: surah.englishName}, dispatch setSurahNames(map)
   *       6) Subscribe auth().onAuthStateChanged — fires once with the restored
   *          session, then unsubscribes
   *       7) navigation.replace(user ? 'Dashboard' : 'Login') — replace (not
   *          navigate) so Splash is removed from the back stack
   *       8) On thrown error: setError(true) + errorMessage, setIsLoading(false);
   *          retry screen shown, auth listener never runs
   * CALLS: downloadAndCacheQuran -> initDatabase, verse count, fetchMissing +
   *        fetchMushafPages; warmIndopakIndexes (fire-and-forget); getSurahs;
   *        dispatch(setSurahNames); auth().onAuthStateChanged
   * CALLED BY: useEffect on mount (line 30) and "Retry Download" button onPress
   *            (line 44)
   * AFFECTS: SQLite (verses, surahs, mushaf_pages), quranSlice.surahNames,
   *          navigation stack (Splash -> Dashboard/Login)
   * NOTES: Route decision happens ONLY inside the onAuthStateChanged callback —
   *        if steps 2-5 throw, the listener is never subscribed and the app
   *        stays on the retry screen. No dispatch(setUser) here: on cold start
   *        redux auth is rehydrated from AsyncStorage (persistConfig whitelist),
   *        but a stale/expired session is still caught by onAuthStateChanged —
   *        the Firebase session is the source of truth, not the Redux flag.
   */
  const load = useCallback(async () => {
    setIsLoading(true); setError(false);
    try {
      await downloadAndCacheQuran();
      if (!indopakWarmStarted) {
        indopakWarmStarted = true;
        InteractionManager.runAfterInteractions(() => {
          setTimeout(() => { warmIndopakIndexes().catch(() => {}); }, 2000);
        });
      }
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
          <ActivityIndicator size="large" color='#1C3D72' style={{ marginTop: 20 }} />
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
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#F8F9FA' },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 20, color: '#1C3D72' },
  subtitle: { fontSize: 16, color: '#888' },
  errorText: { fontSize: 18, color: '#ff4444', textAlign: 'center', marginBottom: 10, fontWeight: 'bold' },
  errorBox: { maxHeight: 200, width: '100%', backgroundColor: '#1A1A1A', borderRadius: 8, padding: 10, marginBottom: 20 },
  errorDetail: { fontSize: 12, color: '#1A1A1A' },
  retryBtn: { backgroundColor: '#1C3D72', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 8 },
  retryText: { color: '#F8F9FA', fontSize: 16, fontWeight: '700' }
});
