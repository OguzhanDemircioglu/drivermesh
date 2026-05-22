// Dinamik Expo config — .env'den runtime değerleri okur. Statik app.json'un
// göremediği process.env.* burada çözülür.
//
// Native build (expo prebuild / run:android) sırasında Google Maps API key
// AndroidManifest ve Info.plist'e gömülür — bu yüzden BUILD ANINDA değer
// doğru env'den gelmelidir.

const googleMapsAndroid =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
const googleMapsIos = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

/** @type {import('@expo/config-types').ExpoConfig} */
module.exports = {
  name: 'DriverMesh Ride',
  slug: 'drivermeshride',
  version: '0.1.8',
  orientation: 'portrait',
  scheme: 'drivermeshride',
  userInterfaceStyle: 'dark',
  newArchEnabled: true,
  icon: './assets/icon.png',
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.drivermesh.ride',
    config: {
      googleMapsApiKey: googleMapsIos,
    },
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'Şoförün sana ulaşabilmesi için konumun gerekli.',
      NSLocationAlwaysAndWhenInUseUsageDescription:
        'Şoförün sana ulaşabilmesi için konumun gerekli.',
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'com.drivermesh.ride',
    versionCode: 9,
    googleServicesFile: './google-services.json',
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION', 'POST_NOTIFICATIONS'],
    // SYSTEM_ALERT_WINDOW ReactNative DEBUG manifest'inden release'e sızıyor.
    blockedPermissions: ['android.permission.SYSTEM_ALERT_WINDOW'],
    adaptiveIcon: {
      foregroundImage: './assets/icon.png',
      backgroundColor: '#0A0E1F',
    },
    config: {
      googleMaps: { apiKey: googleMapsAndroid },
    },
  },
  web: { bundler: 'metro', favicon: './assets/favicon.png' },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-localization',
    [
      'expo-splash-screen',
      {
        image: './assets/drivermesh-splash.png',
        backgroundColor: '#0A0E1F',
        resizeMode: 'cover',
      },
    ],
    // NOT: tam ekran splash için prebuild sonrası scripts/inject-fullscreen-splash.js
    // çalıştırılmalı (expo-splash-screen plugin'i logo-centric stili son anda
    // yazıyor; race olmaması için post-prebuild script kullanıyoruz).
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'Şoförün sana ulaşabilmesi için konumun gerekli.',
      },
    ],
    [
      'expo-notifications',
      {
        color: '#FF7A1A',
        defaultChannel: 'default',
      },
    ],
    // Sentry — kasten devre dışı. Fleet'te kalır, ride'da yok.
  ],
  experiments: { typedRoutes: false },
  extra: {
    appEnv: process.env.EXPO_PUBLIC_APP_ENV ?? 'production',
    router: {},
    eas: { projectId: 'fc9fa0cc-cdab-4e23-abe6-521d8c644216' },
  },
  owner: 'cray61',
};
