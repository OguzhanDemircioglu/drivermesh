import { supabase } from './supabase';
import type { Invitation, UserRole } from './database.types';

export async function listTeamMembers(orgId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listPendingInvitations(orgId: string) {
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
};

export async function createInvitation(input: CreateInvitationInput): Promise<Invitation> {
  const { data, error } = await supabase
    .from('invitations')
    .insert({
      organization_id: input.organizationId,
      email: input.email.trim().toLowerCase(),
      full_name: input.fullName.trim(),
      role: input.role,
      invited_by: input.invitedBy,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function revokeInvitation(invitationId: string) {
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
