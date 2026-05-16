import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { tr } from './locales/tr';

const STORAGE_KEY = '@ride:lang';

function detectInitialLanguage(): 'tr' | 'en' {
  const locales = getLocales();
  const code = locales[0]?.languageCode ?? 'tr';
  return code === 'en' ? 'en' : 'tr';
}

// Eager init with TR. EN is lazy-loaded on demand to keep cold start fast.
i18n.use(initReactI18next).init({
  resources: {
    tr: { translation: tr },
  },
  lng: detectInitialLanguage(),
  fallbackLng: 'tr',
  interpolation: { escapeValue: false },
  returnNull: false,
  compatibilityJSON: 'v4',
});

// Hydrate saved preference (non-blocking).
AsyncStorage.getItem(STORAGE_KEY)
  .then((saved) => {
    if (saved === 'tr' || saved === 'en') void switchLanguage(saved);
  })
  .catch(() => {
    /* ignore */
  });

let enLoaded = false;
async function ensureEnLoaded() {
  if (enLoaded) return;
  const mod = await import('./locales/en');
  i18n.addResourceBundle('en', 'translation', mod.en, true, true);
  enLoaded = true;
}

export async function switchLanguage(lang: 'tr' | 'en') {
  if (lang === 'en') await ensureEnLoaded();
  await i18n.changeLanguage(lang);
  await AsyncStorage.setItem(STORAGE_KEY, lang);
}

export default i18n;
