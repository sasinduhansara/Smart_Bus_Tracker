const { getDefaultConfig } = require('@expo/metro-config');

module.exports = (() => {
  const config = getDefaultConfig(__dirname);

  // Add support for mjs files (needed for some web packages)
  config.resolver.sourceExts.push('mjs');

  // Optional: Configure asset extensions if needed
  // config.resolver.assetExts = config.resolver.assetExts.filter(ext => ext !== 'svg');
  // config.resolver.assetExts.push('svg', 'png', 'jpg', 'jpeg', 'gif');

  return config;
})();