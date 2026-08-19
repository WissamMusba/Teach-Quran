/**
 * FILE: App.tsx
 * ROLE: App shell — wires Redux Provider + PersistGate + ErrorBoundary + SafeArea, hosts
 *       the root Stack navigator, and runs the global periodic/foreground sync scheduler.
 * DEPENDS ON: src/store (redux-persist + all 8 slices), src/api/sync.ts (processSyncQueue),
 *             src/store/syncSlice.ts, src/screens/* (all 9), src/components/ErrorBoundary.tsx
 * USED BY: index.js (import App) — AppInner is internal, exported nowhere.
 */
import React, { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus, InteractionManager, View, Text } from 'react-native';
import mobileAds from 'react-native-google-mobile-ads';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { store, persistor, RootState } from './src/store';
import { PersistGate } from 'redux-persist/integration/react';
import { requestSync } from './src/api/sync';
import { getCachedStudentList, getStudentData } from './src/database/localDB';
import { getFreshnessSnapshot, studentDataIsCurrent, markStudentDataLoaded } from './src/hooks/useStudentDataRefresh';
import SplashScreen from './src/screens/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import StudentHubScreen from './src/screens/StudentHubScreen';
import JuzIndexScreen from './src/screens/JuzIndexScreen';
import SurahIndexScreen from './src/screens/SurahIndexScreen';
import QuranViewScreen from './src/screens/QuranViewScreen';
import BookmarksScreen from './src/screens/BookmarksScreen';
import MistakesScreen from './src/screens/MistakesScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import NotesScreen from './src/screens/NotesScreen';
import LoopSettingsScreen from './src/screens/LoopSettingsScreen';
import { setSyncing, setSynced, setOffline } from './src/store/syncSlice';
import { setStudents, setStudentData } from './src/store/studentSlice';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Module constants: 30-minute PUSH-ONLY sync cadence (local, not in settingsSlice) + root stack builder.
// The interval only pushes the dirty write queue (bookmarks/highlights/notes); pulls happen at
// app-open, on foreground (AppState 'active'), and on manual sync — keeping Firestore reads small
// for the free tier (50K reads/day).
// GOTCHA: the interval is duplicated-in-spirit by DashboardScreen's own pull-to-refresh sync —
// two independent sync loops can overlap.
const SYNC_INTERVAL = 30 * 60 * 1000 // 30-minute sync cadence (per user requirement)

// Auto-full-pull cooldown: skip the start/foreground pull when one ran < 30 min ago.
// Cold start ALWAYS pulls — lastAutoPullAt is module-level, so it resets to 0 on a
// fresh process and the guard never blocks it. Warm foreground re-opens inside the
// window pull nothing (and the foreground trigger never pushes — only background/
// interval/manual do), keeping the Firestore read budget small.
const PULL_COOLDOWN_MS = 30 * 60 * 1000; // 30-minute pull cooldown (per user requirement)
// const PULL_COOLDOWN_MS = 0; // testing: EVERY start/foreground pulls
let lastAutoPullAt = 0;

const Stack = createNativeStackNavigator();

/**
 * WHAT: The tree inside Provider/PersistGate: reads auth + sync state, owns the global
 *       sync scheduler lifecycle, and renders the navigation stack.
 * FLOW: 1) typed useSelector on auth.isAuthenticated — the ONLY typed selector in the app
 *          (all other screens use `(s: any) => ...`); 2) useRef<AppStateStatus> tracks the
 *          previous app-state for edge detection; 3) effect below schedules sync; 4) renders stack.
 * CALLS: dispatch, useSelector; sync scheduler effect.
 * CALLED BY: App() root render.
 * AFFECTS: redux `sync` state; Firestore + SQLite sync_queue (via processSyncQueue).
 * NOTES: (no props)
 */
const AppInner = () => {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  // Latest-value refs (no rely on effect closures for the scheduler).
  const currentStudent = useSelector((s: any) => s.student.currentStudent);
  const studentList = useSelector((s: any) => s.student.list);
  const studentData = useSelector((s: any) => s.student.studentData);
  const studentIdRef = useRef<string | null>(null);
  studentIdRef.current = currentStudent?.id || null;
  const listJsonRef = useRef('');
  const studentDataJsonRef = useRef('');
  useEffect(() => {
    listJsonRef.current = JSON.stringify((studentList || []).map((s: any) => [s?.id || '', s?.updatedAt || '']));
  }, [studentList]);
  useEffect(() => {
    studentDataJsonRef.current = JSON.stringify(studentData || null);
  }, [studentData]);

  /**
   * WHAT: Post-pull Redux refresh (Feature 3) — after a successful pull with
   *   actual changes, silently refreshes what every open screen consumes:
   *   the cached student list (SQLite, NO extra Firestore read) and the current
   *   student's data (bookmarks/lastRead/highlights/notes). Shallow-compare
   *   (ids+updatedAt / JSON fingerprints) before dispatching so idle pulls
   *   never re-render the app. Best-effort: every failure is swallowed.
   * CALLS: getCachedStudentList / getStudentData (localDB), dispatch
   *   (setStudents/setStudentData).
   */
  const refreshReduxAfterPull = useCallback(async () => {
    try {
      const list = await getCachedStudentList();
      if (list) {
        const json = JSON.stringify(list.map((s: any) => [s?.id || '', s?.updatedAt || '']));
        if (json !== listJsonRef.current) { listJsonRef.current = json; dispatch(setStudents(list)); }
      }
    } catch {}
    const sid = studentIdRef.current;
    if (!sid) return;
    try {
      // P2-I — cheap freshness gate BEFORE the heavy read: the JSON-fingerprint below already
      // avoided re-dispatching identical data, but the full chunk read + every chunk's
      // JSON.parse still ran on EVERY post-pull refresh. When SQLite is provably unchanged
      // since the last successful hydration of this student, skip the read entirely.
      const snapshot = await getFreshnessSnapshot(sid);
      if (snapshot === null || studentDataIsCurrent(sid, snapshot)) return;
      const d = await getStudentData(sid);
      if (!d) return;
      markStudentDataLoaded(sid, snapshot);
      const json = JSON.stringify(d);
      if (json !== studentDataJsonRef.current) { studentDataJsonRef.current = json; dispatch(setStudentData(d)); }
    } catch {}
  }, [dispatch]);

  /**
   * WHAT: Global sync scheduler — runs four sync triggers while the user is authenticated.
   * FLOW: 1) early-return when !isAuthenticated (no timers/listeners); 2) TRIGGER #1 —
   *          auto FULL pull at mount (app open) and on every transition to 'active'
   *          (foreground), gated by PULL_COOLDOWN_MS and debounced ~250ms so the app
   *          settles first — silent, fire-and-forget, no alert; 3) TRIGGER #2 — setInterval
   *          runs a PUSH-ONLY runSync() every SYNC_INTERVAL (30 min) — a write safety-net so
   *          dirty bookmarks/highlights/notes get pushed even in a long idle session;
   *          4) TRIGGER #3 — AppState listener: on background/inactive a PUSH-ONLY sync is
   *          scheduled ~600ms later (lets the screen's 400ms-debounced flush land in SQLite
   *          first) so the last edits reach Firestore; 5) TRIGGER #4 — after every successful
   *          pull that changed something (pulled>0 or manifest v bumped), refreshReduxAfterPull
   *          updates the Redux student list + current student data for every open screen.
   * CALLS: dispatch(setSyncing/setSynced/setOffline), requestSync, refreshReduxAfterPull.
   * AFFECTS: sync.status ('syncing'|'synced'|'offline'), pendingChanges; Redux student list/
   *          current student data; Firestore users/{uid}/students/{sid}/data/studentData;
   *          SQLite sync_queue (cleared per student).
   * NOTES: Runs are fire-and-forget — an in-flight promise resolving after unmount still
   *        dispatches (harmless with redux, but double-syncs are possible at app-state edges).
   *        requestSync single-flights overlapping runs (src/api/sync.ts).
   */
  useEffect(() => {
    if (!isAuthenticated) return;

    const runSync = async (opts: { pull?: boolean } = {}) => {
      dispatch(setSyncing());
      const result = await requestSync(opts);
      if (result.success) {
        dispatch(setSynced());
        if (opts.pull && ((result.pulled || 0) > 0 || result.manifestChanged)) {
          void refreshReduxAfterPull();
        }
      }
      else dispatch(setOffline());
    };

    // Cooldown-gated auto full pull, ~250ms after the app settles (start/foreground).
    let autoPullTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleAutoPull = () => {
      if (Date.now() - lastAutoPullAt < PULL_COOLDOWN_MS) return;
      lastAutoPullAt = Date.now();
      if (autoPullTimer) clearTimeout(autoPullTimer);
      autoPullTimer = setTimeout(() => { autoPullTimer = null; void runSync({ pull: true }); }, 250);
    };
    scheduleAutoPull();

    const interval = setInterval(() => {
      runSync();
    }, SYNC_INTERVAL);

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const prev = appState.current; appState.current = next;
      if (prev === next) return;
      if (next === 'active') scheduleAutoPull();
      else runSync(); // background/inactive: push IMMEDIATELY (no setTimeout — it gets killed)
    });

    return () => {
      clearInterval(interval);
      if (autoPullTimer) { clearTimeout(autoPullTimer); autoPullTimer = null; }
      sub.remove();
    };
  }, [isAuthenticated, dispatch, refreshReduxAfterPull]);

  // NavigationContainer + Stack.Navigator — registers the 9-screen native stack, Splash is initial.
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Splash">
        {/* Splash: gate screen — downloads+caches Quran, resolves auth, replaces to Dashboard|Login. */}
        <Stack.Screen name="Splash" component={SplashScreen} options={{ headerShown: false }} />
        {/* Login: replace('Dashboard') on success, navigate('Register'). */}
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        {/* Register: navigate('Login') on success. */}
        <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
        {/* Dashboard: navigate('StudentHub') per student card, replace('Login') on logout. */}
        <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ headerShown: false }} />
        {/* StudentHub: per-student hub — navigates to QuranView (deep links) | Bookmarks | Notes | JuzIndex | SurahIndex. */}
        <Stack.Screen name="StudentHub" component={StudentHubScreen} options={{ headerShown: false }} />
        <Stack.Screen name="JuzIndex" component={JuzIndexScreen} options={{ headerShown: false }} />
        <Stack.Screen name="SurahIndex" component={SurahIndexScreen} options={{ headerShown: false }} />
        {/* QuranView: hub — navigates to Dashboard|Mistakes|Notes|Bookmarks|Settings via page toolbar. */}
        <Stack.Screen name="QuranView" component={QuranViewScreen} options={{ headerShown: false }} />
        {/* GOTCHA: QuranView is navigated to with `{ surahId, scrollToVerse }` cast `as any` from
            Bookmarks/Mistakes/Notes — no RootStackParamList exists, params are untyped. */}
        <Stack.Screen name="Bookmarks" component={BookmarksScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Mistakes" component={MistakesScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Notes" component={NotesScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="LoopSettings" component={LoopSettingsScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

/**
 * WHAT: Root render — wraps everything in the gesture-handler root, error boundary,
 *       safe-area provider, redux Provider, and PersistGate.
 * FLOW: 1) GestureHandlerRootView flex:1 — required parent for RNGH gestures; 2) ErrorBoundary —
 *          renders "App Crashed!" fallback with error text + console.error; 3) SafeAreaProvider —
 *          insets for headerShown:false screens; 4) Provider store — app-wide redux; 5) PersistGate
 *          loading={null} — blocks AppInner until AsyncStorage rehydration completes.
 * CALLS: (rendering only)
 * CALLED BY: index.js
 * AFFECTS: (none — structural)
 * NOTES: loading={null} renders nothing while rehydrating; a corrupt/oversized persisted state
 *        would blank the app with no timeout/fallback.
 */
// ============================================================
// [PERF-CHANGE-4] — REVERTIBLE OPTIMIZATION: defer the Google Mobile Ads
// SDK init off the critical launch path. Previously it fired in a plain
// App() mount useEffect — the ads SDK spins up threads + a network probe
// during first-screen render. Now it waits for
// InteractionManager.runAfterInteractions (so the first screen has painted
// and the user's first gestures have landed) plus a small extra settle delay.
// Banner components tolerate this — they fire their first ad request once
// the SDK settles (~1-2 s later). Ad revenue timing shifts fractionally,
// not functionally.
// REVERSE: restore the single-line useEffect that initialized the SDK
// eagerly, available in git (`git diff HEAD` or release v87, commit
// bed0baf): `useEffect(() => { mobileAds().initialize().catch(() => {}); }, []);`
// ============================================================
const initializeAdsDeferred = () => {
  InteractionManager.runAfterInteractions(() => {
    setTimeout(() => { mobileAds().initialize().catch(() => {}); }, 500);
  });
};
// ============================================================
// END [PERF-CHANGE-4]
// ============================================================

// ============================================================
// [PERF-CHANGE-5] — REVERTIBLE OPTIMIZATION: static placeholder shown
// while redux-persist rehydrates from AsyncStorage. Previously
// PersistGate's loading={null} rendered a fully BLANK screen during the
// 100-800 ms rehydrate on slow storage. This renders a lightweight,
// Redux-independent native-style placeholder so the first pixel is never
// blank. The real Splash screen takes over the moment rehydrate completes.
// REVERSE: set loading={null} on the PersistGate below, as it was in
// release v87 (commit bed0baf).
// ============================================================
const PersistLoadingPlaceholder = () => (
  <View style={{ flex: 1, backgroundColor: '#0d1b2a', justifyContent: 'center', alignItems: 'center' }}>
    <Text style={{ color: '#8ab4d8', fontSize: 20, fontWeight: '600' }}>Teach Quran</Text>
    <Text style={{ color: '#5a7a99', fontSize: 13, marginTop: 8 }}>Loading…</Text>
  </View>
);
// ============================================================
// END [PERF-CHANGE-5]
// ============================================================

const App = () => {
  // Initialize the Google Mobile Ads SDK once, but DEFERRED off the
  // critical launch path so the first screen paints first (PERF-CHANGE-4).
  useEffect(() => { initializeAdsDeferred(); }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <Provider store={store}>
            <PersistGate loading={<PersistLoadingPlaceholder />} persistor={persistor}>
              <AppInner />
            </PersistGate>
          </Provider>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
};

export default App;
