const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add resolver aliases to ensure consistent React imports
config.resolver.alias = {
  'react': path.resolve(__dirname, 'node_modules/react'),
  'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
  'react-native': path.resolve(__dirname, 'node_modules/react-native'),
};

// Platform-specific extensions (web gets .web.tsx files first)
config.resolver.sourceExts = ['tsx', 'ts', 'jsx', 'js', 'mjs', 'cjs', 'json'];
config.resolver.assetExts = [...config.resolver.assetExts, 'css'];
config.resolver.platforms = ['web', 'ios', 'android'];

module.exports = config;