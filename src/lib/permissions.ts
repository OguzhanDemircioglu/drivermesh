import { supabase } from './supabase';
import type { Profile, UserRole } from './database.types';

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
  actor: Pick<Profile, 'id' | 'full_name' | 'role'> | null;
};

export type TeamMemberLite = Pick<
  Profile,
  'id' | 'full_name' | 'email' | 'role' | 'created_at'
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

export async function changeMemberRole(
  memberId: string,
  newRole: UserRole,
): Promise<void> {
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
  const { data, error } = await supabase
    .from('notifications')
    .select('*, actor:profiles!notifications_actor_id_fkey(id, full_name, role)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new PermissionError('notifications_fetch_failed', error.message);
  return (data ?? []) as NotificationWithActor[];
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_notification_read', {
    p_notification_id: notificationId,
  });
  if (error) throw mapPgError(error.message);
}

export async function listOrgMembers(
  organizationId: string,
): Promise<TeamMemberLite[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, created_at')
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
