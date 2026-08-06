/**
 * FILE: src/store/index.ts
 * ROLE: Redux store factory + redux-persist wiring (root key 'root', whitelisted slices).
 * DEPENDS ON: src/store/*Slice.ts (8 files), AsyncStorage.
 * USED BY: App.tsx (store, persistor, RootState); src/screens/SettingsScreen.tsx (RootState —
 *          the ONLY screen importing RootState; all others type useSelector with `any`).
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

// Persistence config: whitelisted slices only. NOTES: student/quran/history are NOT persisted —
// they're rebuilt from SQLite at Splash (getSurahs) and DB queries; whitelisted
// `sync.pendingChanges` survives restarts so the queue push retries correctly.
const persistConfig = { 
  key: 'root', 
  storage: AsyncStorage, 
  whitelist: ['auth', 'drawing', 'sync', 'settings', 'audio'] 
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

// persistReducer wraps every slice; REHYDRATE re-pops whitelisted state at startup.
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
