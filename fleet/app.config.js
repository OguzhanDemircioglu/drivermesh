// Dinamik Expo config — .env'den runtime değerleri okur. Static app.json'un
// göremediği process.env.* burada çözülür.
//
// Native build (expo prebuild / run:android) sırasında Google Maps API key
// AndroidManifest ve Info.plist'e gömülür — bu yüzden BUILD ANINDA değer
// doğru env'den gelmelidir, aksi halde MapView açıldığı an
//   IllegalStateException: API key not found
// fırlatır ve app crash eder.

const googleMapsAndroid =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID ?? '';
const googleMapsIos =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS ?? '';

/** @type {import('@expo/config-types').ExpoConfig} */
module.exports = {
  name: 'DriverMesh Fleet',
  slug: 'drivermesh',
  version: '1.0.7',
  orientation: 'portrait',
  icon: './assets/logo.png',
  scheme: 'drivermesh',
  userInterfaceStyle: 'dark',
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.drivermesh.ios',
    config: {
      googleMapsApiKey: googleMapsIos,
    },
  },
  android: {
    package: 'com.drivermesh.android',
    googleServicesFile: './google-services.json',
    adaptiveIcon: {
      foregroundImage: './assets/logo.png',
      backgroundColor: '#0A0E1F',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    // SYSTEM_ALERT_WINDOW ReactNative DEBUG manifest'inden release'e sızıyor;
    // RECORD_AUDIO eski Expo defaults artığı, kullanılmıyor. blockedPermissions
    // her iki prebuild sonrası manifest'ten otomatik çıkarır.
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.SYSTEM_ALERT_WINDOW',
    ],
    config: {
      googleMaps: { apiKey: googleMapsAndroid },
    },
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
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
    [
      'expo-notifications',
      {
        color: '#FF7A1A',
        defaultChannel: 'default',
      },
    ],
    [
      '@sentry/react-native/expo',
      {
        organization: 'drivermesh',
        project: 'drivermesh-mobile',
        url: 'https://de.sentry.io/',
      },
    ],
  ],
  experiments: { typedRoutes: false },
  extra: {
    appEnv: process.env.EXPO_PUBLIC_APP_ENV ?? 'production',
    router: {},
    eas: { projectId: '8aa98c27-8538-4202-9586-337e148e9abc' },
  },
  owner: 'cray61',
};
