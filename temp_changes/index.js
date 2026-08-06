/**
 * FILE: index.js
 * ROLE: JS entry point — registers the App component with the native React Native runtime.
 * DEPENDS ON: App.tsx, app.json
 * USED BY: (none — consumed by Metro/react-native CLI as the entry file)
 * FIX LOG (2026-08-06 audit): added a global uncaught-JS-exception handler. ErrorBoundary
 * (App.tsx) only catches render/lifecycle errors; async errors and unhandled promise
 * rejections (e.g. DashboardScreen's unguarded createStudent/deleteStudent when offline)
 * were otherwise silent in release builds.
 */
// Ordering-sensitive side-effect import: MUST be the first line so RNGH patches
// the native gesture system before anything renders (required by RN 0.72).
import 'react-native-gesture-handler';
// Polyfills crypto.getRandomValues — used by uuid v4 for drawing/bookmark ids.
import 'react-native-get-random-values';
import { AppRegistry, ErrorUtils } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

/**
 * WHAT: Global uncaught-JS-exception handler — logs anything that falls outside
 *       React's render tree (the ErrorBoundary shield in App.tsx does not cover
 *       async errors or unhandled promise rejections).
 * FLOW: 1) chain the previous handler so the dev redbox keeps working;
 *       2) log the error + fatal flag to console.error (surfaces in Android ADB).
 * CALLS: console.error, previous ErrorUtils handler.
 * CALLED BY: RN runtime on every uncaught JS exception.
 * AFFECTS: ADB log visibility of release-mode JS crashes.
 * NOTES: Registered before AppRegistry.registerComponent so no app code runs without it.
 */
const prevGlobalHandler = ErrorUtils.getGlobalHandler();
ErrorUtils.setGlobalHandler((error, isFatal) => {
  console.error('Uncaught JS Error:', error, { isFatal });
  prevGlobalHandler(error, isFatal);
});

/**
 * WHAT: Registers `App` as the root component under the app name.
 * FLOW: 1) Side-effect imports above run first (ordering matters).
 *       2) registerComponent binds app.json's "QuranMasterApp" name to App.
 * CALLED BY: native side (MainActivity/AppDelegate) via the same app name.
 * NOTES: Native side must use the same name token from app.json.
 */
AppRegistry.registerComponent(appName, () => App);
