/**
 * Telefon yardımcıları (multi-country). Tüm storage E.164 (+<dial><digits>).
 * libphonenumber-js ile parse + format + validate.
 */

import {
  AsYouType,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js';

export function digitsOnly(input: string): string {
  return input.replace(/\D+/g, '');
}

/** AsYouType formatter — kullanıcı yazarken country-specific format (örn. TR "5XX XXX XX XX", US "(XXX) XXX-XXXX"). */
export function formatNationalPhone(raw: string, country: CountryCode): string {
  const f = new AsYouType(country);
  return f.input(digitsOnly(raw));
}

/** E.164 (+ + dial code + national digits). Geçersiz inputlarda boş döner. */
export function toE164(raw: string, country: CountryCode): string {
  const parsed = parsePhoneNumberFromString(digitsOnly(raw), country);
  return parsed?.format('E.164') ?? '';
}

/** Mobile + ülkeye uygun mu (libphonenumber-js bildiriyor). */
export function isValidMobile(raw: string, country: CountryCode): boolean {
  const d = digitsOnly(raw);
  if (d.length < 4) return false;
  return isValidPhoneNumber(d, country);
}

// --- Backward compat (eski TR helper'lar — kaldırılana kadar tutuluyor) ---

/** @deprecated `formatNationalPhone(raw, 'TR')` kullan. */
export function formatTrPhone(raw: string): string {
  return formatNationalPhone(raw, 'TR');
}

/** @deprecated `toE164(raw, 'TR')` kullan. */
export function toE164Tr(raw: string): string {
  return toE164(raw, 'TR');
}

/** @deprecated `isValidMobile(raw, 'TR')` kullan. */
export function isValidTrMobile(raw: string): boolean {
  return isValidMobile(raw, 'TR');
}

/** OTP — 6 hane, sadece rakam */
export function isValidOtp(raw: string): boolean {
  return /^\d{6}$/.test(raw);
}
