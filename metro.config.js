/**
 * FILE: metro.config.js
 * ROLE: Metro bundler config — customizes asset/source extension handling for SVG files.
 * DEPENDS ON: @react-native/metro-config ^0.72.0
 * USED BY: Metro bundler (auto-discovered by the react-native CLI)
 */
const { getDefaultConfig } = require('@react-native/metro-config');

/**
 * WHAT: Augments the default Metro config so `.svg` files are treated as source
 *       modules (importable via `import x from './y.svg'`) instead of binary assets.
 * FLOW: 1) Await getDefaultConfig(__dirname).
 *       2) Set transformer.getTransformOptions -> inlineRequires: true
 *          (module-level require inlining — faster startup, same semantics).
 *       3) Remove 'svg' from assetExts and append it to sourceExts.
 * NOTES: Pairs with react-native-svg ^13.9.0; svg-as-source is the modern pattern.
 */
module.exports = (async () => {
  const defaultConfig = await getDefaultConfig(__dirname);
  const { resolver: { sourceExts, assetExts } } = defaultConfig;

  return {
    ...defaultConfig,
    transformer: {
      ...defaultConfig.transformer,
      getTransformOptions: async () => ({
        transform: {
          experimentalImportSupport: false,
          inlineRequires: true,
        },
      }),
    },
    resolver: {
      ...defaultConfig.resolver,
      assetExts: assetExts.filter(ext => ext !== 'svg'),
      sourceExts: [...sourceExts, 'svg'],
    },
  };
})();
