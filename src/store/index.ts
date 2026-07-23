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
  whitelist: ['auth', 'drawing', 'sync', 'settings', 'audio'] 
};

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

const persistedReducer = persistReducer(persistConfig, rootReducer);
export const store = configureStore({ 
  reducer: persistedReducer, 
  middleware: (g) => g({ serializableCheck: { ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'] } }) 
});
export const persistor = persistStore(store);
export type RootState = ReturnType<typeof store.getState>;
