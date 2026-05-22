// Metro config — Expo defaults + package.json `exports` resolver enabled
// (i18next / react-i18next gibi modern paketlerin ESM dağıtımları için).
//
// Sentry devre dışı — fleet'te kalıyor, ride'da hiç olmayacak. Eskiden
// getSentryExpoConfig sarıcısı vardı; release build'de Sentry CLI source map
// upload denemesi başarısız oluyordu (token yok). Düz Expo defaults yeterli.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.unstable_enablePackageExports = true;

module.exports = config;
