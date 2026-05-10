import { supabase } from './supabase';
import type { Invitation, UserRole } from './database.types';
import { DEMO_ORG_ID, demo, isDemoActive } from '@/demo/store';

export async function listTeamMembers(orgId: string) {
  if (isDemoActive()) return demo.profiles();

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listPendingInvitations(orgId: string) {
  if (isDemoActive()) {
    return demo.invitations().filter((i) => i.status === 'pending');
  }
  const { data, error } = await supabase
    .from('invitations')
    .select('*')
    .eq('organization_id', orgId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

type CreateInvitationInput = {
  organizationId: string;
  email: string;
  fullName: string;
  role: Extract<UserRole, 'manager' | 'driver'>;
  invitedBy: string;
  managerId?: string | null;
};

export async function createInvitation(input: CreateInvitationInput): Promise<Invitation> {
  // Driver davetinde manager_id zorunlu olmasa da uygulanır; manager rolünde
  // null kalır (manager dogrudan owner'a bagli, ayri parent yok).
  const managerId = input.role === 'driver' ? input.managerId ?? null : null;
  if (isDemoActive()) {
    const token = (Math.random().toString(36) + Math.random().toString(36))
      .replace(/[^a-z0-9]/g, '')
      .padEnd(32, 'x')
      .slice(0, 32)
      .toUpperCase();
    const inv: Invitation = {
      id: `demo-inv-${Date.now()}`,
      organization_id: DEMO_ORG_ID,
      email: input.email.trim().toLowerCase(),
      full_name: input.fullName.trim(),
      role: input.role,
      status: 'pending',
      invited_by: input.invitedBy,
      manager_id: managerId,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString(),
      token,
      accepted_at: null,
      accepted_by: null,
    };
    demo.addInvitation(inv);
    return inv;
  }
  const { data, error } = await supabase
    .from('invitations')
    .insert({
      organization_id: input.organizationId,
      email: input.email.trim().toLowerCase(),
      full_name: input.fullName.trim(),
      role: input.role,
      invited_by: input.invitedBy,
      manager_id: managerId,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function revokeInvitation(invitationId: string) {
  if (isDemoActive()) {
    demo.updateInvitation(invitationId, { status: 'revoked' });
    return;
  }
  const { error } = await supabase
    .from('invitations')
    .update({ status: 'revoked' })
    .eq('id', invitationId);
  if (error) throw error;
}

/**
 * Davet token'ından okunabilir 6-haneli kısa kod üretir.
 * UUID hex'in ilk 6 karakterini büyük harfe çevirir; kullanıcılar arası iletişim için yeterince kısa.
 */
export function shortCode(token: string) {
  return token.slice(0, 6).toUpperCase();
}
