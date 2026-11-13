const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const path = require('path');

// The watch mini-app (Zepp OS) and the relay server are separate Node projects: keep them out of the bundle.
const escape = (p) => p.replace(/[/\\]/g, '[/\\\\]');
const config = {
  resolver: {
    blockList: [new RegExp(`^${escape(path.join(__dirname, 'watch'))}[/\\\\].*`), new RegExp(`^${escape(path.join(__dirname, 'server'))}[/\\\\].*`)],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
