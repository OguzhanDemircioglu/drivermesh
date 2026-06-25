// Nilvera e-Arşiv / e-Fatura entegrasyonu.
// NILVERA_API_KEY yoksa: stub — fatura kesilmez, "pending" olay yazılır (loglanır).
// Key gelince: aşağıdaki TODO'daki gerçek çağrı implemente edilir.
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import type { PayablePlan } from './plans.ts';

export async function createNilveraInvoice(opts: {
  admin: SupabaseClient;
  organizationId: string;
  plan: PayablePlan;
  amountTRY: number;
  providerRef?: string | null;
}): Promise<void> {
  const apiKey = Deno.env.get('NILVERA_API_KEY');

  if (!apiKey) {
    console.log('[nilvera] API key yok → fatura atlandı (stub)', {
      org: opts.organizationId,
      plan: opts.plan,
      amount: opts.amountTRY,
    });
    await opts.admin.from('fleet_subscription_events').insert({
      organization_id: opts.organizationId,
      plan: opts.plan,
      action: 'invoice',
      invoice_provider: 'nilvera',
      status: 'pending',
      amount: opts.amountTRY,
      provider_ref: opts.providerRef ?? null,
      payload: { note: 'sandbox/no_key — fatura kesilmedi, key gelince kesilecek' },
    });
    return;
  }

  // TODO(keys): Gerçek Nilvera e-Arşiv fatura çağrısı.
  //   const base = Deno.env.get('NILVERA_API_BASE') ?? 'https://apitest.nilvera.com';
  //   const res = await fetch(`${base}/einvoice/Send/...`, {
  //     method: 'POST',
  //     headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  //     body: JSON.stringify({ /* fatura modeli: VKN, kalem, tutar, KDV ... */ }),
  //   });
  //   ...sonuç → fleet_subscription_events (action='invoice', status='success', invoice_ref=...)
  console.warn('[nilvera] API key var ama gerçek fatura çağrısı henüz implemente değil (TODO).');
  await opts.admin.from('fleet_subscription_events').insert({
    organization_id: opts.organizationId,
    plan: opts.plan,
    action: 'invoice',
    invoice_provider: 'nilvera',
    status: 'pending',
    amount: opts.amountTRY,
    provider_ref: opts.providerRef ?? null,
    payload: { note: 'TODO: Nilvera gerçek entegrasyon' },
  });
}
