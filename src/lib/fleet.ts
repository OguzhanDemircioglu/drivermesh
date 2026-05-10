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
