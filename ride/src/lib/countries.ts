/**
 * Country helpers — libphonenumber-js'in country listesi + Intl.DisplayNames
 * ile lokalize isim + ISO2'den emoji flag.
 *
 * Hermes Intl.DisplayNames Hermes 0.12+ (RN 0.72+) destekliyor. Çalışmazsa
 * fallback olarak ISO2 kodu döner.
 */

import { getCountries, getCountryCallingCode, type CountryCode } from 'libphonenumber-js';

export type Country = {
  iso: CountryCode;
  /** "+90" gibi dial code (kalın olarak, ülke kodu + tireler arasında değil) */
  dialCode: string;
  /** "🇹🇷" — unicode regional indicator çiftleri */
  flag: string;
  /** Cihaz locale'ına göre çevrilmiş ülke adı (örn. "Türkiye" / "Turkey") */
  name: string;
};

const TR_NAMES_OVERRIDE: Record<string, string> = {
  TR: 'Türkiye',
  AZ: 'Azerbaycan',
  DE: 'Almanya',
  AT: 'Avusturya',
  NL: 'Hollanda',
  FR: 'Fransa',
  GB: 'Birleşik Krallık',
  US: 'Amerika Birleşik Devletleri',
  RU: 'Rusya',
  UA: 'Ukrayna',
  SA: 'Suudi Arabistan',
  AE: 'Birleşik Arap Emirlikleri',
  QA: 'Katar',
  KW: 'Kuveyt',
  IR: 'İran',
  GE: 'Gürcistan',
  BG: 'Bulgaristan',
  GR: 'Yunanistan',
  CY: 'Kıbrıs',
  SY: 'Suriye',
  IQ: 'Irak',
  CH: 'İsviçre',
  BE: 'Belçika',
  IT: 'İtalya',
  ES: 'İspanya',
  SE: 'İsveç',
  NO: 'Norveç',
  DK: 'Danimarka',
  FI: 'Finlandiya',
  PL: 'Polonya',
  CZ: 'Çekya',
  RO: 'Romanya',
  HU: 'Macaristan',
  IL: 'İsrail',
  EG: 'Mısır',
  JP: 'Japonya',
  CN: 'Çin',
  KR: 'Güney Kore',
  IN: 'Hindistan',
  AU: 'Avustralya',
  CA: 'Kanada',
  BR: 'Brezilya',
  MX: 'Meksika',
  ZA: 'Güney Afrika',
  TH: 'Tayland',
  ID: 'Endonezya',
};

const POPULAR_ISO: CountryCode[] = [
  'TR', 'AZ', 'DE', 'NL', 'AT', 'GB', 'US', 'FR', 'RU', 'IR',
];

/** ISO2 → emoji flag (regional indicator symbols). "TR" → "🇹🇷" */
export function isoToFlag(iso: string): string {
  if (iso.length !== 2) return '🏳️';
  const base = 0x1f1e6; // 'A' regional indicator
  return String.fromCodePoint(
    base + iso.charCodeAt(0) - 65,
    base + iso.charCodeAt(1) - 65,
  );
}

function getLocalizedName(iso: string, locale: string): string {
  // TR locale için hard-coded override + fallback Intl
  if (locale.startsWith('tr') && TR_NAMES_OVERRIDE[iso]) {
    return TR_NAMES_OVERRIDE[iso];
  }
  try {
    // Hermes Intl.DisplayNames destekliyorsa lokal isim verir
    const dn = new Intl.DisplayNames([locale], { type: 'region' });
    return dn.of(iso) || iso;
  } catch {
    // Hermes Intl.DisplayNames yoksa ISO2 fallback
    return iso;
  }
}

let _cache: Country[] | null = null;
let _cacheLocale = '';

/** Tüm ülkeler — locale değişince yeniden hesaplanır. */
export function getAllCountries(locale = 'en'): Country[] {
  if (_cache && _cacheLocale === locale) return _cache;
  const list: Country[] = [];
  for (const iso of getCountries()) {
    try {
      const dial = `+${getCountryCallingCode(iso)}`;
      list.push({
        iso,
        dialCode: dial,
        flag: isoToFlag(iso),
        name: getLocalizedName(iso, locale),
      });
    } catch {
      // libphonenumber bazı edge case ISO'lar için fail edebilir
    }
  }
  list.sort((a, b) => a.name.localeCompare(b.name, locale));
  _cache = list;
  _cacheLocale = locale;
  return list;
}

/** Popüler ülkeler önce, sonra alfabetik — picker UX için. */
export function getCountriesOrderedForPicker(locale = 'en'): Country[] {
  const all = getAllCountries(locale);
  const byIso = new Map(all.map((c) => [c.iso, c]));
  const popular = POPULAR_ISO.map((iso) => byIso.get(iso)).filter(Boolean) as Country[];
  const rest = all.filter((c) => !POPULAR_ISO.includes(c.iso));
  return [...popular, ...rest];
}

export function getCountryByIso(iso: string, locale = 'en'): Country | null {
  return getAllCountries(locale).find((c) => c.iso === iso) ?? null;
}
