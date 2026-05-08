import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { tr } from './locales/tr';
import { en } from './locales/en';

export type AppLocale = 'tr' | 'en';

const SUPPORTED: AppLocale[] = ['tr', 'en'];
const STORAGE_KEY = 'drivermesh.locale';

/**
 * Cihazın tercih sırası listesinde Türkçe veya Azerbaycan'ca varsa 'tr',
 * yoksa 'en'. `expo-localization.getLocales()` regionCode'tan bağımsız
 * sadece languageCode bakar: 'tr', 'az' → TR; 'en-US', 'en-GB', 'en-AU',
 * 'en-IN' hepsi → EN.
 */
function detectDeviceLocale(): AppLocale {
  const TR_LIKE = new Set(['tr', 'az']);
  try {
    const list = getLocales();
    if (list.some((l) => TR_LIKE.has(l.languageCode?.toLowerCase() ?? ''))) {
      return 'tr';
    }
  } catch {
    /* expo-localization native module yoksa default fallback */
  }
  return 'en';
}

// Module-load senkron init — UI ilk render'da cihaz diline göre çalışır,
// hiçbir flicker yok. setupI18n() yeniden detect ederek değişiklikleri
// senkronlar.
if (!i18n.isInitialized) {
  const initial = detectDeviceLocale();
  i18n.use(initReactI18next).init({
    resources: {
      tr: { translation: tr },
      en: { translation: en },
    },
    lng: initial,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    returnNull: false,
    compatibilityJSON: 'v4',
  });
}

export async function setupI18n(): Promise<AppLocale> {
  // Sistem dili her açılışta source of truth. AsyncStorage'a in-app toggle
  // ile yazılan değer son session'a aittir; sistem dili değiştiyse onu
  // override etmemeli. Bu yüzden ilk olarak cihaz dilini tespit ediyoruz,
  // stored sadece sistem ile EŞLEŞTİĞİNDE veya o session'da set edildiyse
  // anlamlıdır. Pratik karar: stored'ı yok say, cihaz dili kazansın.
  const locale = detectDeviceLocale();
  try {
    await AsyncStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }
  if (locale !== i18n.language) {
    await i18n.changeLanguage(locale);
  }
  return locale;
}

export async function setAppLocale(locale: AppLocale) {
  await i18n.changeLanguage(locale);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }
}

export function getAppLocale(): AppLocale {
  return (i18n.language as AppLocale) ?? 'tr';
}

export default i18n;
