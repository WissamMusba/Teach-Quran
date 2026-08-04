/**
 * FILE: index.js
 * ROLE: JS entry point — registers the App component with the native React Native runtime.
 * DEPENDS ON: App.tsx, app.json
 * USED BY: (none — consumed by Metro/react-native CLI as the entry file)
 */
// Ordering-sensitive side-effect import: MUST be the first line so RNGH patches
// the native gesture system before anything renders (required by RN 0.72).
import 'react-native-gesture-handler';
// Polyfills crypto.getRandomValues — used by uuid v4 for drawing/bookmark ids.
import 'react-native-get-random-values';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

/**
 * WHAT: Registers `App` as the root component under the app name.
 * FLOW: 1) Side-effect imports above run first (ordering matters).
 *       2) registerComponent binds app.json's "QuranMasterApp" name to App.
 * CALLED BY: native side (MainActivity/AppDelegate) via the same app name.
 * NOTES: Native side must use the same name token from app.json.
 */
AppRegistry.registerComponent(appName, () => App);