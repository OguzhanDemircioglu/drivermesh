import { supabase } from './supabase';
import { destroyImage, publicIdFromUrl } from './cloudinary';
import { clearDemoStorage, isDemoActive } from '@/demo/store';

/**
 * Permanently delete the entire fleet (organization, members, vehicles,
 * jobs, invitations, notifications, permission overrides). Owner-only.
 *
 * Demo mode wipes the persisted demo state on disk so the next sign-in
 * re-seeds from scratch. The deactivation itself happens via signOut()
 * the caller invokes immediately after — running deactivateDemo here
 * would race with signOut and leave `isDemo` flag stuck true.
 *
 * Production akış:
 *   1. Org'daki tüm Cloudinary asset URL'lerini client'tan topla ve
 *      destroy et (RPC server-side Postgres function HTTP atamaz).
 *   2. `delete_fleet()` RPC çağrılır — security definer caller'ın
 *      organization_id'sini kendi çıkarır, RLS'e takılmadan org-scoped
 *      cascade siler.
 */
export async function deleteFleet(orgId: string): Promise<void> {
  if (isDemoActive()) {
    await clearDemoStorage();
    return;
  }
  // delete_fleet RPC server-side; Postgres function Cloudinary'ye HTTP
  // atamaz. Onun yerine RPC'den ÖNCE org'daki tüm asset URL'lerini topla
  // ve client'tan destroy et. Best-effort: hata olursa RPC yine de çalışır.
  const [vehiclesRes, reqsRes] = await Promise.all([
    supabase
      .from('vehicles')
      .select('photo_url, maintenance_photo_urls')
      .eq('organization_id', orgId),
    supabase
      .from('maintenance_requests')
      .select('photo_urls')
      .eq('organization_id', orgId),
  ]);
  const urls: string[] = [];
  for (const v of vehiclesRes.data ?? []) {
    if (v.photo_url) urls.push(v.photo_url);
    for (const u of v.maintenance_photo_urls ?? []) urls.push(u);
  }
  for (const r of reqsRes.data ?? []) {
    for (const u of r.photo_urls ?? []) urls.push(u);
  }
  for (const url of urls) {
    const pid = publicIdFromUrl(url);
    if (pid) destroyImage(pid).catch((e) => console.warn('[fleet/delete] destroy', e));
  }
  const { error } = await supabase.rpc('delete_fleet');
  if (error) throw new Error(error.message);
}

/**
 * Magaza zorunlu: kullanicinin uygulama icinden hesap silebilmesi gerek
 * (Apple App Store + Google Play 2022'den beri zorunlu).
 *
 * Owner self-delete yapilamaz (filo yetim kalir) — RPC server-side guard'i var.
 * Owner once filoyu silmeli veya patronlugu devretmelidir.
 *
 * Manager/driver: profile + iliskili veriler temizlenir (notifications,
 * permission_overrides, vehicles.current_user_id, open/assigned jobs.driver_id).
 * auth.users row da silinir (SECURITY DEFINER ile).
 *
 * Demo'da: clearDemoStorage yeterli (in-memory state, signOut sonrasi yeniden seed).
 */
export async function deleteOwnAccount(): Promise<void> {
  if (isDemoActive()) {
    await clearDemoStorage();
    return;
  }
  const { data, error } = await supabase.rpc('request_account_deletion');
  if (error) throw new Error(error.message);
  if (data && typeof data === 'object' && 'ok' in data && data.ok === false) {
    const err = (data as { error?: string; message?: string });
    throw new Error(err.message ?? err.error ?? 'account_deletion_failed');
  }
}
