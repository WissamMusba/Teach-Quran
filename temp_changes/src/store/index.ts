/**
 * FILE: src/store/index.ts
 * ROLE: Redux store factory + redux-persist wiring (root key 'root', whitelisted slices).
 * DEPENDS ON: src/store/*Slice.ts (8 files), AsyncStorage.
 * USED BY: App.tsx (store, persistor, RootState); src/screens/SettingsScreen.tsx (RootState —
 *          the ONLY screen importing RootState; all others type useSelector with `any`).
 * PERSIST DESIGN:
 *   - whitelist: ['auth', 'drawing', 'sync', 'settings', 'audio'] only. student/quran/history
 *     are NOT persisted — they're rebuilt from SQLite at Splash (getSurahs) + DB queries;
 *     `sync.pendingChanges` survives restarts so the queue push retries correctly.
 *   - version: 1 + migrate(): redux-persist calls config.migrate with the stored state on
 *     EVERY PERSIST, so this normalize step doubles as a lazy schema guard. It drops unknown/
 *     stale keys written by older builds and force-resets transient flags that must never
 *     restore from storage: audio.isPlaying, drawing.toolbarExpanded, sync.status.
 *   - Future schema changes: bump `version` and extend `migrate` to rewrite old shapes
 *     (redux-persist only diffs versions when using createMigrate; the normalizer below is
 *     idempotent, so it is safe to run on every boot).
 */
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import authReducer from './authSlice';
import studentReducer from './studentSlice';
import quranReducer from './quranSlice';
import syncReducer from './syncSlice';
import historyReducer from './historySlice';
import drawingReducer from './drawingSlice';
import settingsReducer from './settingsSlice';
import audioReducer from './audioSlice';

const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  version: 1,
  whitelist: ['auth', 'drawing', 'sync', 'settings', 'audio'],
  // Normalizes each whitelisted slice on every rehydrate. Must return a promise
  // (redux-persist v6 awaits config.migrate) and tolerate `inbound === undefined`
  // (fresh install / storage read failure -> fall back to slice defaults).
  migrate: async (inbound: any) => {
    if (!inbound) return inbound;
    const out: any = { ...inbound };
    if (out.auth) out.auth = {
      // Stale persisted `user` may be a raw firebase object from older builds; the only
      // consumer is App.tsx's isAuthenticated gate, so normalize the flag but keep user as-is.
      user: out.auth.user ?? null,
      isAuthenticated: !!out.auth.isAuthenticated
    };
    if (out.drawing) {
      const tool = ['pen', 'eraser', 'underline', 'laser'].includes(out.drawing.activeTool) ? out.drawing.activeTool : 'pen';
      out.drawing = {
        toolbarExpanded: false, // transient UI flag — never restore the bar expanded on boot
        activeTool: tool,
        activeColor: typeof out.drawing.activeColor === 'string' ? out.drawing.activeColor : '#FF0000',
        penSize: typeof out.drawing.penSize === 'number' && out.drawing.penSize > 0 ? out.drawing.penSize : 4
      };
    }
    if (out.sync) out.sync = {
      status: 'idle', // transient — a killed mid-sync run must not restore 'syncing'/'offline'
      pendingChanges: typeof out.sync.pendingChanges === 'number' && out.sync.pendingChanges >= 0 ? Math.floor(out.sync.pendingChanges) : 0
    };
    if (out.settings) out.settings = {
      nightMode: typeof out.settings.nightMode === 'boolean' ? out.settings.nightMode : true,
      textBrightness: typeof out.settings.textBrightness === 'number' ? out.settings.textBrightness : 255,
      bgBrightness: typeof out.settings.bgBrightness === 'number' ? out.settings.bgBrightness : 18,
      translationTextSize: typeof out.settings.translationTextSize === 'number' ? out.settings.translationTextSize : 16,
      showPageInfo: typeof out.settings.showPageInfo === 'boolean' ? out.settings.showPageInfo : true,
      mushafSplit: !!out.settings.mushafSplit,
      playBasmala: typeof out.settings.playBasmala === 'boolean' ? out.settings.playBasmala : true
    };
    if (out.audio) out.audio = {
      isPlaying: false, // transient — a killed mid-playback run must not restore 'playing'
      currentQari: typeof out.audio.currentQari === 'string' ? out.audio.currentQari : 'Mishary Al-Afasy',
      currentSurah: typeof out.audio.currentSurah === 'number' ? out.audio.currentSurah : 1,
      currentAyah: typeof out.audio.currentAyah === 'number' ? out.audio.currentAyah : 1,
      position: typeof out.audio.position === 'number' ? out.audio.position : 0,
      duration: typeof out.audio.duration === 'number' ? out.audio.duration : 0
    };
    return out;
  }
};

// Aggregate all 8 slice reducers under their state keys.
const rootReducer = combineReducers({
  auth: authReducer,
  student: studentReducer,
  quran: quranReducer,
  sync: syncReducer,
  history: historyReducer,
  drawing: drawingReducer,
  settings: settingsReducer,
  audio: audioReducer
});

// persistReducer wraps every slice; REHYDRATE re-pops whitelisted state at startup
// (passed through `migrate` above first).
const persistedReducer = persistReducer(persistConfig, rootReducer);
// Store keeps the default middleware chain but relaxes serializableCheck for the two
// persist action types (firestore/date objects in slices would otherwise warn).
// NOTES: thunk implicitly enabled; no other middleware config.
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (g) => g({ serializableCheck: { ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'] } })
});
// Starts AsyncStorage write-back of the whitelist; consumed by PersistGate in App.tsx.
export const persistor = persistStore(store);
// Typed root state — used by App.tsx and SettingsScreen.tsx only; no `useAppSelector`
// hook exists, everything else reads `useSelector((s: any) => ...)`.
export type RootState = ReturnType<typeof store.getState>;
