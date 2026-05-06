import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { tr } from './locales/tr';
import { en } from './locales/en';

export type AppLocale = 'tr' | 'en';

const SUPPORTED: AppLocale[] = ['tr', 'en'];
const STORAGE_KEY = 'drivermesh.locale';

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
  let locale: AppLocale = 'tr';
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED.includes(stored as AppLocale)) {
      locale = stored as AppLocale;
    }
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
