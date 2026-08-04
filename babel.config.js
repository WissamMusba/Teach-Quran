/**
 * FILE: babel.config.js
 * ROLE: Babel config for Metro — enables the standard React Native transform preset.
 * DEPENDS ON: metro-react-native-babel-preset (devDependency)
 * USED BY: Metro/Babel toolchain (transpiles all TS/TSX/JS in the bundle)
 */

/**
 * WHAT: Applies the single 'module:metro-react-native-babel-preset' preset.
 * NOTES: No custom plugins; svg-as-source is handled by Metro (metro.config.js),
 *        not by Babel.
 */
module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
};
