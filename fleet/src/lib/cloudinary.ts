// ============================================================================
// Cloudinary client helper
// ----------------------------------------------------------------------------
// İki Edge Function'ı kullanır:
// - cloudinary-sign: imzali upload param'ları üretir (server-side, secret korur)
// - cloudinary-destroy: bir public_id'yi siler (DB'den foto silinince çağırılır)
//
// Demo path Cloudinary'ye gitmez — file/data URI'i ham haliyle döner; gerçek
// asset üretilmediği için demo silme de no-op.
// ============================================================================
import { supabase } from './supabase';
import { isDemoActive } from '@/demo/store';

interface SignResponse {
  signature: string;
  timestamp: number;
  api_key: string;
  cloud_name: string;
  folder: string;
  public_id?: string;
  tags?: string[];
  upload_url: string;
}

export interface CloudinaryAsset {
  /** Cloudinary secure_url — DB'ye `*_url` veya array içine yazılır. */
  secureUrl: string;
  /** Silme için saklanacak Cloudinary public_id (folder + name, uzantısız). */
  publicId: string;
}

/**
 * Bir lokal dosya/URI'ı Cloudinary'ye yükler ve secure_url + public_id döndürür.
 * `folder` 'drivermesh/...' ile başlamalı (Edge Function bunu enforce ediyor).
 */
export async function uploadImage(
  fileUri: string,
  folder: string,
  opts?: { publicId?: string; tags?: string[]; mimeType?: string },
): Promise<CloudinaryAsset> {
  if (isDemoActive()) {
    // Demo: gerçek upload yapma, picker'dan dönen URI'yi olduğu gibi DB'ye
    // yaz. publicId fake — destroy'de no-op olduğu için uyumsuzluk yok.
    const fakeId = `${folder}/demo-${Date.now()}`;
    return { secureUrl: fileUri, publicId: fakeId };
  }

  // 1) Sign Edge Function'ı çağır (JWT verify, server-side)
  const { data, error } = await supabase.functions.invoke<SignResponse>('cloudinary-sign', {
    body: {
      folder,
      public_id: opts?.publicId,
      tags: opts?.tags,
    },
  });
  if (error) throw error;
  if (!data) throw new Error('cloudinary-sign empty response');
  const sig = data;

  // 2) Multipart POST Cloudinary upload endpoint'ine
  const form = new FormData();
  form.append('file', {
    uri: fileUri,
    type: opts?.mimeType ?? 'image/jpeg',
    name: 'upload.jpg',
  } as unknown as Blob);
  form.append('api_key', sig.api_key);
  form.append('timestamp', String(sig.timestamp));
  form.append('signature', sig.signature);
  form.append('folder', sig.folder);
  if (sig.public_id) form.append('public_id', sig.public_id);
  if (sig.tags && sig.tags.length) form.append('tags', sig.tags.join(','));

  const res = await fetch(sig.upload_url, { method: 'POST', body: form as unknown as BodyInit });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`cloudinary upload failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { secure_url: string; public_id: string };
  return { secureUrl: json.secure_url, publicId: json.public_id };
}

/**
 * Cloudinary'deki asset'i siler. DB tarafından (UI/lib) foto kaydı silinince
 * çağırılır — boşa yer kaplamasın diye. Demo'da no-op.
 */
export async function destroyImage(publicId: string): Promise<void> {
  if (isDemoActive()) return;
  if (!publicId || publicId.startsWith('drivermesh/') === false) {
    // Edge Function de blokluyor ama erken çık.
    return;
  }
  const { error } = await supabase.functions.invoke('cloudinary-destroy', {
    body: { public_id: publicId },
  });
  if (error) throw error;
}

/**
 * Cloudinary secure_url'den public_id'yi çıkarır. Geriye dönük migrate veya
 * eski kayıtlardan public_id türetmek için. Mevcut akışta upload'tan dönen
 * publicId'yi DB'ye birlikte yazıyoruz, bu yüzden çoğu zaman gerek olmaz.
 *
 * Örn:
 *   https://res.cloudinary.com/dotcw6tty/image/upload/v123/drivermesh/cars/abc.jpg
 *   -> drivermesh/cars/abc
 */
export function publicIdFromUrl(url: string): string | null {
  const m = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^./]+)?$/);
  return m ? m[1] : null;
}
