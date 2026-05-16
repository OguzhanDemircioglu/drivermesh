// Metro config — Expo defaults + package.json `exports` resolver enabled
// (i18next / react-i18next gibi modern paketlerin ESM dağıtımları için).
//
// `getSentryExpoConfig` Expo defaults'unu sarar; release build'lerde Hermes
// source map'leri ayrı dosyalar olarak üretir, Sentry CLI assembleRelease
// sırasında upload eder. Dev'de davranış getDefaultConfig ile aynıdır.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);

config.resolver.unstable_enablePackageExports = true;

module.exports = config;
