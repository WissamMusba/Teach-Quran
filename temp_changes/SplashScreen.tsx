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
import React, { useEffect, useState, useCallback, useRef } from 'react'
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { downloadAndCacheQuran, getSurahs } from '../database/quranData'
import auth from '@react-native-firebase/auth'
import { useDispatch } from 'react-redux'
import { setSurahNames } from '../store/quranSlice'

// DOWNLOAD_TIMEOUT_MS: cap on the blocking download step. quranData.ts's fetches
// have no timeout of their own (fetch() has no default timeout on Android) — a
// hanging network (captive portal, dead Wi-Fi with a stale lease) can stall the
// splash spinner forever with no user recourse, since the Retry button only
// renders in the error state. 120s is generous for a fresh 114-surah download;
// anything slower is treated as a dead network and surfaced as an error + Retry.
// The abandoned download keeps running in the background harmlessly —
// downloadAndCacheQuran is idempotent and transactional.
const DOWNLOAD_TIMEOUT_MS = 120000

// WHAT: Races a promise against a wall-clock timer; rejects with a friendly
//       message when the promise has not settled in `ms`. The timer is cleared
//       once the race settles so nothing is left dangling.
// CALLS: Promise.race
// CALLED BY: load() below (wraps downloadAndCacheQuran)
// AFFECTS: SplashScreen error state on timeout
const withTimeout = (promise: Promise<any>, ms: number) => {
  let timer: ReturnType<typeof setTimeout> | null = null
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Download timed out. Check your connection and try again.')), ms)
  })
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

export default function SplashScreen({ navigation }: any) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  // loadRef: in-flight guard so a double-tap on "Retry Download" (or an
  // unmount/re-mount race) cannot launch two concurrent downloads and two
  // onAuthStateChanged subscriptions.
  const loadRef = useRef(false)
  const dispatch = useDispatch()

  /**
   * WHAT: Full startup sequence: download+verify the Quran DB, load surah names
   *       into Redux, then wait for Firebase auth and navigate away.
   * FLOW: 1) Reject if a load is already in flight (loadRef guard) — a retry
   *          tap cannot stack a second download+listener on the first.
   *       2) setIsLoading(true), setError(false)
   *       3) await withTimeout(downloadAndCacheQuran(), 120s) — seeds SQLite
   *          (verses/surahs/mushaf_pages); idempotent verse-count check; does
   *          NOT throw on partial completion (MIN_USABLE_VERSES path). A hang
   *          past 120s rejects with a timeout error instead of spinning forever.
   *       4) await getSurahs() — SELECT * FROM surahs ORDER BY id
   *       5) Build map = {surah.id: surah.englishName}, dispatch
   *          setSurahNames(map)
   *       6) Subscribe auth().onAuthStateChanged — fires once with the restored
   *          session, then unsubscribes
   *       7) navigation.replace(user ? 'Dashboard' : 'Login') — replace (not
   *          navigate) so Splash is removed from the back stack
   *       8) On thrown error (download failure, timeout, getSurahs failure):
   *          setError(true) + errorMessage, setIsLoading(false); retry screen
   *          shown, auth listener never runs
   * CALLS: downloadAndCacheQuran -> initDatabase, verse count, fetchMissing +
   *        fetchMushafPages; getSurahs; dispatch(setSurahNames);
   *        auth().onAuthStateChanged
   * CALLED BY: useEffect on mount and "Retry Download" button onPress
   * AFFECTS: SQLite (verses, surahs, mushaf_pages), quranSlice.surahNames,
   *          navigation stack (Splash -> Dashboard/Login)
   * NOTES: Route decision happens ONLY inside the onAuthStateChanged callback —
   *        if steps 3-5 throw, the listener is never subscribed and the app
   *        stays on the retry screen. No dispatch(setUser) here: on cold start
   *        redux auth is rehydrated from AsyncStorage (persistConfig whitelist),
   *        but a stale/expired session is still caught by onAuthStateChanged —
   *        the Firebase session is the source of truth, not the Redux flag.
   *        Offline first launch fails fast (fetch rejects) and shows Retry;
   *        offline relaunch with a fully-cached DB returns true without
   *        touching the network (no deadlock either way).
   */
  const load = useCallback(async () => {
    if (loadRef.current) return
    loadRef.current = true
    setIsLoading(true)
    setError(false)
    try {
      await withTimeout(downloadAndCacheQuran(), DOWNLOAD_TIMEOUT_MS)
      const surahs = await getSurahs()
      const map: Record<string, string> = {}
      surahs.forEach((s: any) => { map[s.id] = s.englishName })
      dispatch(setSurahNames(map))
      const unsub = auth().onAuthStateChanged(user => {
        navigation.replace(user ? 'Dashboard' : 'Login')
        unsub()
      })
    } catch (e: any) {
      setError(true)
      setErrorMessage(e.message || JSON.stringify(e))
      setIsLoading(false)
    } finally {
      loadRef.current = false
    }
  }, [navigation, dispatch])

  /**
   * WHAT: Runs the full load sequence exactly once on mount.
   * FLOW: 1) Called after first render; load is recreated only when navigation
   *          or dispatch changes (useCallback deps), so the effect fires once.
   * CALLS: load
   * CALLED BY: React on component mount
   * AFFECTS: kicks off DB download + auth routing
   */
  useEffect(() => { load() }, [load])

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
  )
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
})
