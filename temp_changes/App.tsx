/**
 * FILE: App.tsx
 * ROLE: App shell — wires Redux Provider + PersistGate + ErrorBoundary + SafeArea, hosts
 *       the root Stack navigator, and runs the global periodic/foreground sync scheduler.
 * DEPENDS ON: src/store (redux-persist + all 8 slices), src/api/sync.ts (processSyncQueue),
 *             src/store/syncSlice.ts, src/screens/* (all 12), src/components/ErrorBoundary.tsx
 * USED BY: index.js (import App) — AppInner is internal, exported nowhere.
 */
import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { store, persistor, RootState } from './src/store';
import { PersistGate } from 'redux-persist/integration/react';
import { requestSync } from './src/api/sync';
import SplashScreen from './src/screens/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import StudentHubScreen from './src/screens/StudentHubScreen';
import SurahIndexScreen from './src/screens/SurahIndexScreen';
import JuzIndexScreen from './src/screens/JuzIndexScreen';
import QuranViewScreen from './src/screens/QuranViewScreen';
import BookmarksScreen from './src/screens/BookmarksScreen';
import MistakesScreen from './src/screens/MistakesScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import NotesScreen from './src/screens/NotesScreen';
import { setSyncing, setSynced, setOffline } from './src/store/syncSlice';
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

  /**
   * WHAT: Global sync scheduler — runs three sync triggers while the user is authenticated.
   * FLOW: 1) early-return when !isAuthenticated (no timers/listeners); 2) TRIGGER #1 —
   *          initial pull sync (runSync({ pull: true })) on effect run; 3) TRIGGER #2 — setInterval
   *          runs a PUSH-ONLY runSync() every SYNC_INTERVAL (30 min) — a write safety-net so dirty
   *          bookmarks/highlights/notes get pushed even in a long idle session (pulls happen only on
   *          open/foreground/manual); 4) TRIGGER #3 — AppState listener syncs on every transition
   *          between 'active' and any other state (foreground = pull sync, background = push-only);
   *          5) cleanup clears the interval, the deferred background timer, and the listener.
   * CALLS: dispatch(setSyncing/setSynced/setOffline), requestSync.
   * AFFECTS: sync.status ('syncing'|'synced'|'offline'), pendingChanges; Firestore
   *          users/{uid}/students/{sid}/data/studentData; SQLite sync_queue (cleared per student).
   * NOTES: requestSync single-flights overlapping runs (src/api/sync.ts): a run issued while
   *        another is in flight resolves `undefined` — runSync treats that as a no-op (the
   *        in-flight run owns the terminal status), so a push-only trigger colliding with a
   *        pull can never crash on a null result nor leave status stuck at 'syncing'. The
   *        background push is scheduled ONLY on 'background' — 'inactive' (iOS control
   *        center / Android app switcher) just updates edge tracking, so iOS's
   *        inactive→background double-fire cannot double-run. The 600ms deferral is tracked
   *        and cleared on cleanup so a logout/re-login inside the window cannot fire it late.
   */
  useEffect(() => {
    if (!isAuthenticated) return;

    const runSync = async (opts: { pull?: boolean } = {}) => {
      dispatch(setSyncing())
      let result: any
      try {
        result = await requestSync(opts)
      } catch (e: any) {
        console.warn('Scheduler sync run threw:', e?.message || e)
        result = { success: false, error: e?.message }
      }
      if (!result) return // coalesced into an in-flight run — it owns the terminal status
      if (result.success) dispatch(setSynced())
      else dispatch(setOffline())
    };

    // Reset edge tracking — transitions while logged out were missed (listener torn
    // down), so a stale prev would misclassify the first transition after re-login.
    appState.current = AppState.currentState;

    runSync({ pull: true });

    const interval = setInterval(() => {
      runSync();
    }, SYNC_INTERVAL);

    // Deferred push-only run for backgrounding: 600ms lets the 400ms-debounced SQLite
    // flushes (QuranViewScreen.updateData) land in the queue before it is drained.
    let bgTimer: ReturnType<typeof setTimeout> | null = null;

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const prev = appState.current; appState.current = next;
      if (prev === next) return;
      if (next === 'active') runSync({ pull: true });
      else if (next === 'background') bgTimer = setTimeout(() => runSync(), 600);
    });

    return () => {
      clearInterval(interval);
      if (bgTimer) clearTimeout(bgTimer);
      sub.remove();
    };
  }, [isAuthenticated, dispatch]);

  // NavigationContainer + Stack.Navigator — registers the 12-screen native stack, Splash is initial.
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
        {/* StudentHub: per-student hub — 6 rows; deep-links into QuranView|Bookmarks|Notes|SurahIndex|JuzIndex. */}
        <Stack.Screen name="StudentHub" component={StudentHubScreen} options={{ headerShown: false }} />
        {/* SurahIndex: standalone surah picker host — navigate('QuranView', {surahId, scrollToVerse:1}|{page}). */}
        <Stack.Screen name="SurahIndex" component={SurahIndexScreen} options={{ headerShown: false }} />
        {/* JuzIndex: standalone para index — navigate('QuranView', {surahId, scrollToVerse}). */}
        <Stack.Screen name="JuzIndex" component={JuzIndexScreen} options={{ headerShown: false }} />
        {/* QuranView: the reader — back returns to StudentHub; navigates to Mistakes|Notes|Bookmarks|Settings via page toolbar. */}
        <Stack.Screen name="QuranView" component={QuranViewScreen} options={{ headerShown: false }} />
        {/* GOTCHA: QuranView is navigated to with `{ surahId, scrollToVerse }` cast `as any` from
            Bookmarks/Mistakes/Notes — no RootStackParamList exists, params are untyped. */}
        <Stack.Screen name="Bookmarks" component={BookmarksScreen} options={{ title: 'Bookmarks' }} />
        <Stack.Screen name="Mistakes" component={MistakesScreen} options={{ title: 'Mistakes' }} />
        <Stack.Screen name="Notes" component={NotesScreen} options={{ title: 'Notes' }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
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
const App = () => {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <Provider store={store}>
            <PersistGate loading={null} persistor={persistor}>
              <AppInner />
            </PersistGate>
          </Provider>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
};

export default App;
