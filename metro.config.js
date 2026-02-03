const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
const { transformer, resolver } = config;

// Add resolver aliases to ensure consistent React imports
config.resolver.alias = {
  'react': path.resolve(__dirname, 'node_modules/react'),
  'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
  'react-native': path.resolve(__dirname, 'node_modules/react-native'),
};

// Platform-specific extensions (web gets .web.tsx files first)
config.transformer = {
  ...transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),
};
config.resolver.sourceExts = [...resolver.sourceExts, 'svg'];
config.resolver.assetExts = resolver.assetExts.filter((ext) => ext !== 'svg').concat('css');
config.resolver.platforms = ['web', 'ios', 'android'];

module.exports = config;
