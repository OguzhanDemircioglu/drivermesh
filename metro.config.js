// Metro config — Expo defaults + package.json `exports` resolver enabled
// (i18next / react-i18next gibi modern paketlerin ESM dağıtımları için gerekli)
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.unstable_enablePackageExports = true;

module.exports = config;
