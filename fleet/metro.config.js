// Metro config — Expo defaults + package.json `exports` resolver enabled
// (i18next / react-i18next gibi modern paketlerin ESM dağıtımları için gerekli)
//
// `getSentryExpoConfig` Expo defaults'unu sarar; release build'lerde Hermes
// source map'leri ayrik dosyalar olarak uretir, Sentry CLI assembleRelease
// sirasinda upload eder. Dev'de davranis getDefaultConfig ile aynidir.
const path = require('path');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);

config.resolver.unstable_enablePackageExports = true;

// Web bundle'da react-native-maps native modülü `codegenNativeComponent`
// fail eder. Platform=web için local shim'e yönlendir; mobile build'lerde
// gerçek paket kullanılır (bu kod yolu sadece web build'de tetiklenir).
const webShims = {
  'react-native-maps': path.resolve(__dirname, 'src/web-shims/react-native-maps.web.tsx'),
};

const baseResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && webShims[moduleName]) {
    return { type: 'sourceFile', filePath: webShims[moduleName] };
  }
  if (baseResolveRequest) return baseResolveRequest(context, moduleName, platform);
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
