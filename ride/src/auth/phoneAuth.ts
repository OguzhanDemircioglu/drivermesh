/**
 * Türkiye GSM telefon yardımcıları. Tüm storage E.164 formatında (+905XXXXXXXXX).
 */

export function digitsOnly(input: string): string {
  return input.replace(/\D+/g, '');
}

/** Görüntü formatı: "5XX XXX XX XX" */
export function formatTrPhone(input: string): string {
  const d = digitsOnly(input).slice(0, 10);
  const parts = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)].filter(
    Boolean,
  );
  return parts.join(' ');
}

/** Kullanıcının yazdığı 10 haneli TR cep numarasından E.164'e çevir. */
export function toE164Tr(raw: string): string {
  const d = digitsOnly(raw).slice(-10);
  return `+90${d}`;
}

/** 10 haneli + 5 ile başlıyor mu? */
export function isValidTrMobile(raw: string): boolean {
  const d = digitsOnly(raw);
  return d.length === 10 && d.startsWith('5');
}

/** OTP — 6 hane, sadece rakam */
export function isValidOtp(raw: string): boolean {
  return /^\d{6}$/.test(raw);
}
