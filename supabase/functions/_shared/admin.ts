// Service-role Supabase client + plan aktivasyonu.
// RLS bypass eder — plan değişimi YALNIZCA buradan (server) yapılır.
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import type { PayablePlan } from './plans.ts';

export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/**
 * Bir organizasyonun planını aktive eder ve abonelik olayı yazar.
 * Tüm provider'lar (sandbox / paytr / paddle) başarılı ödemede bunu çağırır.
 */
export async function activatePlan(opts: {
  admin: SupabaseClient;
  organizationId: string;
  plan: PayablePlan;
  provider: string;          // sandbox | paytr | paddle
  providerRef?: string | null;
  amount: number;            // TL
  currency?: string;
  createdBy?: string | null;
  periodDays?: number;       // aylık = 30
}): Promise<void> {
  const renewsAt = new Date(Date.now() + (opts.periodDays ?? 30) * 86_400_000).toISOString();

  const { error: upErr } = await opts.admin
    .from('organizations')
    .update({
      plan: opts.plan,
      plan_status: 'active',
      plan_provider: opts.provider,
      plan_external_ref: opts.providerRef ?? null,
      plan_renews_at: renewsAt,
      plan_updated_at: new Date().toISOString(),
    })
    .eq('id', opts.organizationId);
  if (upErr) throw new Error(`plan_update_failed: ${upErr.message}`);

  const { error: evErr } = await opts.admin.from('fleet_subscription_events').insert({
    organization_id: opts.organizationId,
    plan: opts.plan,
    action: 'upgrade',
    provider: opts.provider,
    provider_ref: opts.providerRef ?? null,
    amount: opts.amount,
    currency: opts.currency ?? 'TRY',
    status: 'success',
    created_by: opts.createdBy ?? null,
  });
  if (evErr) console.error('[activatePlan] event insert failed (plan yine de aktif):', evErr.message);
}
