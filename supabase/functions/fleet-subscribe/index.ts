// DriverMesh Fleet — Abonelik başlatma (Pro / Pro+)
//
// Endpoint: POST /functions/v1/fleet-subscribe
// Body: { plan: 'pro' | 'pro_plus' }
// Headers: Authorization: Bearer <supabase JWT>
//
// ÖNEMLİ: Bu fonksiyon WEB checkout'tan çağrılır (drivermesh.com). Uygulama
// İÇİNDEN çağrılmamalı — Google Play Billing politikası gereği app içi dijital
// satış Play Billing ister. App yalnızca planı OKUR (fleet_plan_status RPC).
//
// Akış:
//   - JWT doğrula → profil (owner olmalı, org'u olmalı)
//   - PAYMENTS_SANDBOX=true → planı anında aktive et (gerçek ödeme yok)
//   - değilse (yurt içi) → PayTR token üret, ödeme iframe URL'i döndür
//     (ödeme tamamlanınca paytr-callback planı aktive eder)
//   - Faz 2 (yurt dışı) → Paddle (henüz slot)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { isPayablePlan, isSandbox, PLANS } from '../_shared/plans.ts';
import { activatePlan, adminClient } from '../_shared/admin.ts';
import { createNilveraInvoice } from '../_shared/nilvera.ts';
import { createPayTRToken, payTRConfig } from '../_shared/paytr.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://www.drivermesh.com';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return json({ error: 'unauthorized' }, 401);

    const body = await req.json().catch(() => ({})) as { plan?: string };
    if (!isPayablePlan(body.plan)) return json({ error: 'invalid_plan' }, 400);
    const planCfg = PLANS[body.plan];

    // Profil: sadece OWNER abonelik başlatabilir
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name, email, organization_id')
      .eq('id', user.id)
      .maybeSingle();
    if (!profile?.organization_id) return json({ error: 'no_org' }, 400);
    if (profile.role !== 'owner') return json({ error: 'forbidden_only_owner' }, 403);

    const admin = adminClient();
    const orgId = profile.organization_id as string;

    // --- SANDBOX: gerçek ödeme yok, plan anında aktive (ilk-20 promo) ------
    if (isSandbox()) {
      const PROMO_LIMIT = Number(Deno.env.get('PROMO_LIMIT') ?? '20');
      // Bu org zaten promo ile yükseltilmiş mi? (pro→pro_plus tekrar consume etmesin)
      const { data: orgRow } = await admin
        .from('organizations').select('plan, plan_provider').eq('id', orgId).maybeSingle();
      const alreadyPromo = !!orgRow && orgRow.plan !== 'free' && orgRow.plan_provider === 'sandbox';
      // Şimdiye dek promo'lu org sayısı.
      const { count: promoUsed } = await admin
        .from('organizations')
        .select('id', { count: 'exact', head: true })
        .neq('plan', 'free')
        .eq('plan_provider', 'sandbox');
      if (!alreadyPromo && (promoUsed ?? 0) >= PROMO_LIMIT) {
        // İlk-20 kotası doldu → ücretsiz promo yok, web'den ödeme gerekir.
        return json({ status: 'promo_full', promo_remaining: 0 });
      }

      await activatePlan({
        admin,
        organizationId: orgId,
        plan: planCfg.plan,
        provider: 'sandbox',
        providerRef: `sandbox_${Date.now()}`,
        amount: planCfg.priceTRY,
        createdBy: user.id,
      });
      await createNilveraInvoice({
        admin,
        organizationId: orgId,
        plan: planCfg.plan,
        amountTRY: planCfg.priceTRY,
      }).catch((e) => console.error('[fleet-subscribe] nilvera (sandbox):', e.message));

      return json({ status: 'activated', plan: planCfg.plan, sandbox: true });
    }

    // --- PayTR (yurt içi, TRY) --------------------------------------------
    const cfg = payTRConfig();
    if (!cfg) return json({ error: 'paytr_not_configured' }, 503);

    const merchantOid = `dm${orgId.replace(/-/g, '').slice(0, 12)}${Date.now()}`;
    const userIp = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || '127.0.0.1';
    const email = (profile.email as string) ?? user.email ?? 'noreply@drivermesh.com';

    // Ödeme tamamlanınca callback bulabilsin diye PENDING olay yaz
    await admin.from('fleet_subscription_events').insert({
      organization_id: orgId,
      plan: planCfg.plan,
      action: 'payment',
      provider: 'paytr',
      provider_ref: merchantOid,
      amount: planCfg.priceTRY,
      status: 'pending',
      created_by: user.id,
    });

    const { iframeUrl } = await createPayTRToken({
      cfg,
      merchantOid,
      email,
      amountKurus: Math.round(planCfg.priceTRY * 100),
      userIp,
      userName: (profile.full_name as string) ?? 'DriverMesh',
      basketLabel: planCfg.label,
      okUrl: `${SITE_URL}/abonelik/basarili`,
      failUrl: `${SITE_URL}/abonelik/hata`,
      testMode: false,
    });

    return json({ status: 'redirect', plan: planCfg.plan, url: iframeUrl });
  } catch (e) {
    console.error('[fleet-subscribe] error:', e);
    return json({ error: 'internal_error', message: (e as Error).message }, 500);
  }
});
