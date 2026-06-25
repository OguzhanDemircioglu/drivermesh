// DriverMesh Fleet — PayTR ödeme bildirimi (webhook / callback)
//
// PayTR, ödeme sonucunu bu URL'e form-POST eder. PayTR panelinde
// "Bildirim URL" olarak ayarlanır:  /functions/v1/paytr-callback
//
// Güvenlik: JWT yok — doğrulama HASH ile yapılır (merchant_key/salt).
// PayTR, işlem bitince düz "OK" yanıtı bekler; aksi halde tekrar dener.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { adminClient, activatePlan } from '../_shared/admin.ts';
import { payTRConfig, verifyPayTRCallback } from '../_shared/paytr.ts';
import { createNilveraInvoice } from '../_shared/nilvera.ts';
import { isPayablePlan, PLANS } from '../_shared/plans.ts';

serve(async (req) => {
  if (req.method !== 'POST') return new Response('only_post', { status: 405 });

  const cfg = payTRConfig();
  if (!cfg) {
    console.error('[paytr-callback] PayTR yapılandırılmamış');
    return new Response('PAYTR_NOT_CONFIGURED', { status: 503 });
  }

  try {
    const form = new URLSearchParams(await req.text());
    const merchantOid = form.get('merchant_oid') ?? '';
    const status = form.get('status') ?? '';
    const totalAmount = form.get('total_amount') ?? '';
    const hash = form.get('hash') ?? '';

    const valid = await verifyPayTRCallback({ cfg, merchantOid, status, totalAmount, hash });
    if (!valid) {
      console.error('[paytr-callback] HASH UYUŞMUYOR', { merchantOid });
      return new Response('PAYTR notification failed: bad hash', { status: 400 });
    }

    const admin = adminClient();

    // merchant_oid → bekleyen olay (org + plan)
    const { data: ev } = await admin
      .from('fleet_subscription_events')
      .select('id, organization_id, plan, status, created_by')
      .eq('provider_ref', merchantOid)
      .eq('provider', 'paytr')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!ev) {
      console.error('[paytr-callback] eşleşen olay yok', { merchantOid });
      return new Response('OK'); // PayTR'a OK de ki tekrar denemesin
    }

    // İdempotans: zaten işlenmişse tekrar aktive etme
    if (ev.status === 'success') return new Response('OK');

    if (status === 'success' && isPayablePlan(ev.plan)) {
      await activatePlan({
        admin,
        organizationId: ev.organization_id,
        plan: ev.plan,
        provider: 'paytr',
        providerRef: merchantOid,
        amount: PLANS[ev.plan].priceTRY,
        createdBy: ev.created_by,
      });
      await admin.from('fleet_subscription_events')
        .update({ status: 'success' }).eq('id', ev.id);
      await createNilveraInvoice({
        admin,
        organizationId: ev.organization_id,
        plan: ev.plan,
        amountTRY: PLANS[ev.plan].priceTRY,
        providerRef: merchantOid,
      }).catch((e) => console.error('[paytr-callback] nilvera:', e.message));
    } else {
      await admin.from('fleet_subscription_events')
        .update({ status: 'failed', payload: { failed_reason_msg: form.get('failed_reason_msg') } })
        .eq('id', ev.id);
    }

    return new Response('OK'); // PayTR zorunlu
  } catch (e) {
    console.error('[paytr-callback] error:', e);
    return new Response('error', { status: 500 });
  }
});
