// Metro config — Expo defaults + package.json `exports` resolver enabled
// (i18next / react-i18next gibi modern paketlerin ESM dağıtımları için gerekli)
//
// `getSentryExpoConfig` Expo defaults'unu sarar; release build'lerde Hermes
// source map'leri ayrik dosyalar olarak uretir, Sentry CLI assembleRelease
// sirasinda upload eder. Dev'de davranis getDefaultConfig ile aynidir.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);

config.resolver.unstable_enablePackageExports = true;

module.exports = config;
