import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './store';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { processSyncQueue } from './api/sync';
import { SYNC_INTERVAL } from './utils/theme';
import ErrorBoundary from './components/ErrorBoundary';
import SplashScreen from './screens/SplashScreen';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import DashboardScreen from './screens/DashboardScreen';
import QuranViewScreen from './screens/QuranViewScreen';
import BookmarksScreen from './screens/BookmarksScreen';
import MistakesScreen from './screens/MistakesScreen';
import NotesScreen from './screens/NotesScreen';
import SettingsScreen from './screens/SettingsScreen';
const Stack = createNativeStackNavigator();
const AppNavigator = () => {
  const appState = useRef<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    const interval = setInterval(() => processSyncQueue().catch(() => {}), SYNC_INTERVAL);
    const sub = AppState.addEventListener('change', next => { const prev = appState.current; appState.current = next; if (prev === 'active' && next !== 'active') processSyncQueue().catch(() => {}); if (prev !== 'active' && next === 'active') processSyncQueue().catch(() => {}); });
    return () => { clearInterval(interval); sub.remove(); };
  }, []);
  return (<NavigationContainer><Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right', animationDuration: 250 }}>
    <Stack.Screen name="Splash" component={SplashScreen} /><Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Register" component={RegisterScreen} /><Stack.Screen name="Dashboard" component={DashboardScreen} />
    <Stack.Screen name="QuranView" component={QuranViewScreen} /><Stack.Screen name="Bookmarks" component={BookmarksScreen} />
    <Stack.Screen name="Mistakes" component={MistakesScreen} /><Stack.Screen name="Notes" component={NotesScreen} />
    <Stack.Screen name="Settings" component={SettingsScreen} />
  </Stack.Navigator></NavigationContainer>);
};
export default function App() {
  return (<ErrorBoundary><Provider store={store}><PersistGate loading={null} persistor={persistor}><SafeAreaProvider><GestureHandlerRootView style={{ flex: 1 }}><AppNavigator /></GestureHandlerRootView></SafeAreaProvider></PersistGate></Provider></ErrorBoundary>);
}
