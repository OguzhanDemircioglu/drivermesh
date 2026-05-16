import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';

export type Customer = Database['public']['Tables']['customers']['Row'];
export type CustomerInsert = Database['public']['Tables']['customers']['Insert'];
export type CustomerUpdate = Database['public']['Tables']['customers']['Update'];

export async function getMyCustomer(authUserId: string): Promise<Customer | null> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

type UpsertInput = {
  authUserId: string;
  phone: string;
  fullName?: string | null;
  language?: 'tr' | 'en';
};

export async function upsertMyCustomer(input: UpsertInput): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .upsert(
      {
        auth_user_id: input.authUserId,
        phone: input.phone,
        full_name: input.fullName ?? null,
        language: input.language ?? 'tr',
      },
      { onConflict: 'auth_user_id' },
    )
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateMyCustomer(
  id: string,
  patch: CustomerUpdate,
): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function clearPushToken(id: string): Promise<void> {
  await supabase
    .from('customers')
    .update({
      push_token: null,
      push_platform: null,
      push_token_updated_at: new Date().toISOString(),
    })
    .eq('id', id);
}
