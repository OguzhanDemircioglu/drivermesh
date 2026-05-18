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

/**
 * Mağaza zorunlu: müşteri kendi hesabını uygulama içinden silebilmeli
 * (Apple App Store + Google Play 2022'den beri zorunlu).
 *
 * Soft delete + 30 gün retention:
 * - customers.deleted_at set, push_token temizlenir
 * - auth.users.banned_until = now() + 30 gün (login lock)
 * - 30 gün içinde geri dönmek mümkün (admin/destek yoluyla unban)
 * - 30 gün sonra cleanup cron'u hard delete tetikler
 *
 * Aktif ride varsa engeller (T1 hatası): önce ride'ı tamamla/iptal et.
 */
export async function deleteMyCustomerAccount(): Promise<void> {
  const { data, error } = await supabase.rpc('request_customer_account_deletion');
  if (error) throw new Error(error.message);
  if (data && typeof data === 'object' && 'ok' in data && data.ok === false) {
    const err = data as { error?: string; message?: string };
    throw new Error(err.message ?? err.error ?? 'customer_account_deletion_failed');
  }
}
