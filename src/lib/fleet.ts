import { supabase } from './supabase';
import { isDemoActive } from '@/demo/store';

/**
 * Permanently delete the entire fleet (organization, members, vehicles,
 * jobs, invitations, notifications, permission overrides). Owner-only.
 *
 * Demo mode is a no-op here — there's no real DB to wipe. The caller is
 * expected to `signOut()` immediately after, which is what actually
 * deactivates demo + clears React auth state. Doing the deactivation
 * here would race with signOut and leave `isDemo` flag stuck true.
 * Real backend needs an RPC (`delete_fleet`) that cascades inside a
 * transaction.
 */
export async function deleteFleet(orgId: string): Promise<void> {
  if (isDemoActive()) {
    return;
  }
  // TODO: backend RPC — delete_fleet must cascade across:
  //   organizations, profiles, vehicles, jobs, invitations, notifications,
  //   permission_overrides, role_default_permissions (org-scoped if any).
  const { error } = await (supabase.rpc as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ error: { message: string } | null }>)('delete_fleet', {
    p_organization_id: orgId,
  });
  if (error) throw new Error(error.message);
}
