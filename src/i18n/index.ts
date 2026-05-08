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
 * Cihazın tercih sırası listesinde Türkçe varsa 'tr', yoksa 'en'.
 * `expo-localization.getLocales()` kullanıcının system Settings → Languages
 * sıralı listesini döndürür; biri 'tr' ise (regionCode'tan bağımsız —
 * Almanya'da yaşayan TR konuşan biri için de Türkçe gelsin) Türkçe açarız.
 */
function detectDeviceLocale(): AppLocale {
  try {
    const list = getLocales();
    if (list.some((l) => l.languageCode?.toLowerCase() === 'tr')) {
      return 'tr';
    }
  } catch {
    /* expo-localization native module yoksa default fallback */
  }
  return 'en';
}

// Module-load senkron init — UI ilk render'da TR default ile direkt çalışır.
// AsyncStorage'dan stored locale'i okuma setupI18n() üzerinden arka planda yapılır.
if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      tr: { translation: tr },
      en: { translation: en },
    },
    lng: 'tr',
    fallbackLng: 'tr',
    interpolation: { escapeValue: false },
    returnNull: false,
    compatibilityJSON: 'v4',
  });
}

export async function setupI18n(): Promise<AppLocale> {
  // Önce kullanıcının daha önce manuel seçtiği locale'i ara — bu hep
  // önceliklidir. Eğer yoksa cihaz dil tercihinden oku, "tr" varsa
  // Türkçe, yoksa İngilizce. İlk seferde de diske yazıyoruz ki sonraki
  // açılışta cihazı tekrar sorgulamak zorunda kalmayalım.
  let locale: AppLocale | null = null;
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED.includes(stored as AppLocale)) {
      locale = stored as AppLocale;
    }
  } catch {
    /* ignore */
  }
  if (!locale) {
    locale = detectDeviceLocale();
    try {
      await AsyncStorage.setItem(STORAGE_KEY, locale);
    } catch {
      /* ignore */
    }
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
