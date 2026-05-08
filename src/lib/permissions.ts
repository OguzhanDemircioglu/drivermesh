import { supabase } from './supabase';
import type { Profile, UserRole } from './database.types';
import { demo, isDemoActive, listDemoMemberPermissions } from '@/demo/store';
import i18n from '@/i18n';

export type PermissionCategory =
  | 'vehicles'
  | 'jobs'
  | 'members'
  | 'reports'
  | 'settings';

export type MemberPermission = {
  key: string;
  category: PermissionCategory;
  is_critical: boolean;
  label_tr: string;
  label_en: string;
  sort_order: number;
  default_allowed: boolean;
  override_allowed: boolean | null;
  effective_allowed: boolean;
};

export type PermissionGrantPayload = {
  key: string;
  allowed: boolean;
  member_id: string;
  granted_by: string;
};

export type Notification = {
  id: string;
  organization_id: string;
  recipient_id: string;
  actor_id: string | null;
  type: string;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

export type NotificationWithActor = Notification & {
  actor: Pick<Profile, 'id' | 'full_name' | 'role' | 'avatar_url'> | null;
};

export type TeamMemberLite = Pick<
  Profile,
  'id' | 'full_name' | 'email' | 'role' | 'created_at' | 'avatar_url'
>;

export class PermissionError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = 'PermissionError';
  }
}

function mapPgError(message: string): PermissionError {
  if (/cannot_delegate_unowned_permission/.test(message))
    return new PermissionError('cannot_delegate_unowned_permission', message);
  if (/cannot_edit_own_permissions/.test(message))
    return new PermissionError('cannot_edit_own_permissions', message);
  if (/cannot_edit_owner_permissions/.test(message))
    return new PermissionError('cannot_edit_owner_permissions', message);
  if (/cannot_promote_to_owner/.test(message))
    return new PermissionError('cannot_promote_to_owner', message);
  if (/cannot_remove_owner/.test(message))
    return new PermissionError('cannot_remove_owner', message);
  if (/cannot_remove_self/.test(message))
    return new PermissionError('cannot_remove_self', message);
  if (/cross_org_forbidden/.test(message))
    return new PermissionError('cross_org_forbidden', message);
  if (/unauthorized/.test(message))
    return new PermissionError('unauthorized', message);
  if (/member_not_found/.test(message))
    return new PermissionError('member_not_found', message);
  return new PermissionError('unknown', message);
}

/**
 * Hand the fleet over to another member. Atomically swaps the current owner
 * with the target — the current owner becomes the target's previous role
 * (manager or driver), the target becomes owner. There must remain exactly
 * one owner at all times.
 *
 * The real backend needs a dedicated RPC (`transfer_ownership`); demo mode
 * mutates the in-memory profiles list directly.
 */
export async function transferOwnership(toMemberId: string): Promise<void> {
  if (isDemoActive()) {
    const allProfiles = demo.profiles();
    const owner = allProfiles.find((p) => p.role === 'owner');
    const target = demo.profileById(toMemberId);
    if (!owner) throw new PermissionError('member_not_found', 'No current owner');
    if (!target) throw new PermissionError('member_not_found');
    if (target.id === owner.id) {
      throw new PermissionError('unauthorized', 'Already the owner');
    }
    const targetPreviousRole = target.role;
    // Direct mutation — `demo.profiles()` returns a defensive copy so we
    // can't write through it; reach into the underlying profile reference
    // by id. Both `profileById` results are live references in the store.
    const ownerLive = demo.profileById(owner.id)!;
    const targetLive = demo.profileById(target.id)!;
    targetLive.role = 'owner';
    ownerLive.role = targetPreviousRole;
    return;
  }
  // TODO: backend RPC — see permissions migration.
  const { error } = await (supabase.rpc as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ error: { message: string } | null }>)('transfer_ownership', {
    p_to_member_id: toMemberId,
  });
  if (error) throw mapPgError(error.message);
}

export async function changeMemberRole(
  memberId: string,
  newRole: UserRole,
): Promise<void> {
  if (isDemoActive()) {
    if (newRole === 'owner') throw new PermissionError('cannot_promote_to_owner');
    // demo store doesn't expose direct profile mutator — quick patch via vehicles map
    // (we expose updateProfileRole below as a convenience)
    const p = demo.profileById(memberId);
    if (!p) throw new PermissionError('member_not_found');
    if (p.role === 'owner') throw new PermissionError('cannot_edit_owner_permissions');
    p.role = newRole;
    return;
  }
  // RPC not yet in generated types, cast minimally to avoid widening the type bundle.
  const { error } = await (supabase.rpc as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ error: { message: string } | null }>)('change_member_role', {
    p_member_id: memberId,
    p_new_role: newRole,
  });
  if (error) throw mapPgError(error.message);
}

export async function removeOrgMember(memberId: string): Promise<void> {
  if (isDemoActive()) {
    const p = demo.profileById(memberId);
    if (!p) throw new PermissionError('member_not_found');
    if (p.role === 'owner') throw new PermissionError('cannot_remove_owner');
    // permanent removal — not exposed in demo (would shrink team count); soft-no-op
    throw new PermissionError(
      'unauthorized',
      i18n.t('errors.demoMemberRemoveDisabled'),
    );
  }
  const { error } = await (supabase.rpc as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ error: { message: string } | null }>)('remove_org_member', {
    p_member_id: memberId,
  });
  if (error) throw mapPgError(error.message);
}

export async function listMemberPermissions(
  memberId: string,
): Promise<MemberPermission[]> {
  if (isDemoActive()) return listDemoMemberPermissions(memberId);

  const { data, error } = await supabase.rpc('list_member_permissions', {
    p_member_id: memberId,
  });
  if (error) throw mapPgError(error.message);
  return (data ?? []) as MemberPermission[];
}

export async function setPermissionOverride(
  memberId: string,
  key: string,
  allowed: boolean | null,
): Promise<void> {
  if (isDemoActive()) {
    demo.setPermissionOverride(memberId, key, allowed);
    return;
  }
  // Backend RPC accepts NULL p_allowed to delete the override (revert to default).
  // Generated types declare it `boolean` non-null; cast keeps the nullable behaviour.
  const { error } = await supabase.rpc('set_permission_override', {
    p_member_id: memberId,
    p_key: key,
    p_allowed: allowed as boolean,
  });
  if (error) throw mapPgError(error.message);
}

export async function checkPermission(
  userId: string,
  key: string,
): Promise<boolean> {
  if (isDemoActive()) {
    // Owner has full access in demo (mirrors the real backend semantics).
    const profile = demo.profileById(userId);
    if (profile?.role === 'owner') return true;
    const perms = listDemoMemberPermissions(userId);
    return perms.find((p) => p.key === key)?.effective_allowed ?? false;
  }
  const { data, error } = await supabase.rpc('has_permission', {
    p_user_id: userId,
    p_key: key,
  });
  if (error) throw mapPgError(error.message);
  return Boolean(data);
}

export async function listNotifications(
  limit = 50,
): Promise<NotificationWithActor[]> {
  if (isDemoActive()) {
    return demo
      .notifications()
      .slice(0, limit)
      .map((n) => {
        const actor = n.actor_id ? demo.profileById(n.actor_id) : null;
        return {
          ...n,
          payload: n.payload as Record<string, unknown>,
          actor: actor
            ? {
                id: actor.id,
                full_name: actor.full_name,
                role: actor.role,
                avatar_url: actor.avatar_url,
              }
            : null,
        };
      });
  }
  const { data, error } = await supabase
    .from('notifications')
    .select('*, actor:profiles!notifications_actor_id_fkey(id, full_name, role, avatar_url)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new PermissionError('notifications_fetch_failed', error.message);
  return (data ?? []) as NotificationWithActor[];
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  if (isDemoActive()) {
    demo.markNotificationRead(notificationId);
    return;
  }
  const { error } = await supabase.rpc('mark_notification_read', {
    p_notification_id: notificationId,
  });
  if (error) throw mapPgError(error.message);
}

export async function listOrgMembers(
  organizationId: string,
): Promise<TeamMemberLite[]> {
  if (isDemoActive()) {
    const order: Record<UserRole, number> = { owner: 0, manager: 1, driver: 2 };
    return demo
      .profiles()
      .map((p) => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        role: p.role,
        created_at: p.created_at,
        avatar_url: p.avatar_url,
      }))
      .sort(
        (a, b) =>
          order[a.role] - order[b.role] || a.created_at.localeCompare(b.created_at),
      );
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, created_at, avatar_url')
    .eq('organization_id', organizationId)
    .order('role', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw new PermissionError('members_fetch_failed', error.message);
  return (data ?? []) as TeamMemberLite[];
}

export const ROLE_RANK: Record<UserRole, number> = {
  owner: 0,
  manager: 1,
  driver: 2,
};
