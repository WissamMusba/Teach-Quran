import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { store, persistor, RootState } from './src/store';
import { PersistGate } from 'redux-persist/integration/react';
import { processSyncQueue } from './src/api/sync';
import { SYNC_INTERVAL } from './src/utils/constants';

import SplashScreen from './src/screens/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import QuranViewScreen from './src/screens/QuranViewScreen';
import BookmarksScreen from './src/screens/BookmarksScreen';
import MistakesScreen from './src/screens/MistakesScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { setSyncing, setSynced, setOffline } from './src/store/syncSlice';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const Stack = createNativeStackNavigator();

const AppInner = () => {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;
    const initialSync = async () => {
      dispatch(setSyncing());
      const result = await processSyncQueue();
      if (result.success) dispatch(setSynced(new Date().toISOString()));
      else dispatch(setOffline());
    };
    initialSync();

    const intervalId = setInterval(async () => {
      dispatch(setSyncing());
      const result = await processSyncQueue();
      if (result.success) dispatch(setSynced(new Date().toISOString()));
      else dispatch(setOffline());
    }, SYNC_INTERVAL);

    return () => clearInterval(intervalId);
  }, [isAuthenticated, dispatch]);

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Splash">
        <Stack.Screen name="Splash" component={SplashScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Students', headerBackVisible: false }} />
        <Stack.Screen name="QuranView" component={QuranViewScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Bookmarks" component={BookmarksScreen} options={{ title: 'Bookmarks' }} />
        <Stack.Screen name="Mistakes" component={MistakesScreen} options={{ title: 'Mistakes' }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

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