import { supabase } from './supabase';
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
 * Production: `delete_fleet()` RPC kullanılır. Caller'ın oturumundaki
 * organization_id'yi backend security definer fonksiyonu çıkarır;
 * `orgId` parametresi bu yüzden kullanılmaz ama API uyumluluğu için
 * imzada kalır.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function deleteFleet(_orgId: string): Promise<void> {
  if (isDemoActive()) {
    await clearDemoStorage();
    return;
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
