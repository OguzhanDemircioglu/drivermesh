/**
 * Photo authenticity client lib.
 *
 * Backend `photo-authenticity-check` v6 edge fn'ini fire-and-forget
 * cagirir. UI bekletmez — edge fn arkada cluster CPU calistirir
 * (3-15 sn, 3 katman: Cloudinary EXIF + HF AI-detector + HF ViT
 * content classifier). Sonuc DB row'una yazilir, polling ile veya
 * sonraki query'de gorunur.
 *
 * Demo modda hicbir is yapmaz — fake authenticity skor uretmek
 * yaniltici olur, demo data zaten cleanly seed edilmis.
 */
import { isDemoActive } from '@/demo/store';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';

export type AuthenticityTable = 'maintenance_requests' | 'vehicles';

export type ExifStatus = 'valid' | 'missing' | 'suspicious' | 'stale';

export type AuthenticitySummary = {
  suspected_ai: boolean;
  ai_score: number;
  exif_status: ExifStatus;
  content_class: 'vehicle' | 'non_vehicle' | 'unknown';
  content_top_label: string;
  content_score: number;
};

/**
 * Backend'e fotograflari analiz et de. Fire-and-forget — Promise
 * return edilir ama caller await etmek zorunda degil.
 *
 * Demo modda no-op (resolve immediately).
 *
 * Hata durumunda Sentry'ye raporlanir, throw etmez (UI eylemi
 * tamamlanmis olduigu icin authenticity check'in basarisizligi
 * caller'i etkilememeli).
 */
export async function checkPhotoAuthenticity(
  table: AuthenticityTable,
  rowId: string,
  photoUrls: string[],
): Promise<void> {
  if (isDemoActive()) return;
  if (!photoUrls.length) return;

  try {
    const { data, error } = await supabase.functions.invoke(
      'photo-authenticity-check',
      {
        body: {
          table,
          row_id: rowId,
          photo_urls: photoUrls,
        },
      },
    );
    if (error) {
      console.warn('[photoAuthenticity] invoke failed', error.message);
      captureException(error, { context: 'photo_authenticity', table, rowId });
      return;
    }
    const payload = data as { ok?: boolean; error?: string };
    if (!payload?.ok) {
      console.warn('[photoAuthenticity] payload error', payload?.error);
    }
  } catch (e) {
    captureException(e, { context: 'photo_authenticity_throw', table, rowId });
  }
}

/**
 * Aggregate summary'den UI badge tipi cikar. Patron kartinda
 * gosterilecek "kirmizi flag" turu.
 */
export type AuthenticityBadge =
  | 'wrong_content'   // foto bir arac degil (kedi, selfie, dokuman)
  | 'ai_generated'    // AI ile uretilmis suphesi
  | 'exif_missing'    // EXIF metadata yok (download/screenshot)
  | 'exif_stale'      // EXIF DateTimeOriginal 30+ gun eski
  | null;             // saglikli, badge gosterme

export function badgeFromSummary(s: Partial<AuthenticitySummary> | null | undefined): AuthenticityBadge {
  if (!s) return null;
  // Oncelik sirasi: yanlis icerik > AI > EXIF eksik > EXIF eski
  if (s.content_class === 'non_vehicle') return 'wrong_content';
  if (s.suspected_ai) return 'ai_generated';
  if (s.exif_status === 'missing') return 'exif_missing';
  if (s.exif_status === 'stale') return 'exif_stale';
  return null;
}
