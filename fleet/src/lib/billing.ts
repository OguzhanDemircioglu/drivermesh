import { supabase } from './supabase';
import { demo, isDemoActive } from '@/demo/store';

// Fleet abonelik planı — DB'deki public.fleet_plan ile aynı.
export type FleetPlan = 'free' | 'pro' | 'pro_plus';
export type PayablePlan = 'pro' | 'pro_plus';

export interface PlanStatus {
  plan: FleetPlan;
  status: string; // active | past_due | canceled
  vehicleCount: number;
  limit: number | null; // null = sınırsız (pro_plus)
  canAdd: boolean; // limit dolmadı mı
  renewsAt: string | null;
  promoRemaining: number; // kalan ücretsiz "ilk 20" yükseltme hakkı
  orgIsPromo: boolean; // bu org zaten promo ile mi yükseltildi
  noOrg?: boolean;
}

export type UpgradeResult =
  | { status: 'activated'; plan: PayablePlan } // sandbox/promo: ücretsiz yükseltildi
  | { status: 'redirect'; url: string } // keys live: web/PayTR ödemesi
  | { status: 'promo_full' } // ilk-20 doldu, web'den ödeme gerekir
  | { status: 'error'; message: string };

// DB fleet_plan_vehicle_limit() ile AYNI tutulmalı.
const PLAN_LIMIT: Record<FleetPlan, number | null> = { free: 3, pro: 10, pro_plus: null };

// Demo modda plan in-memory tutulur (reload'da sıfırlanır — Play reviewer akışı için).
let demoPlan: FleetPlan = 'free';

/**
 * Org'un mevcut planını + araç kullanımını + limitini + promo durumunu döner.
 * Gerçek: fleet_plan_status() RPC (sunucu otoritesi). Demo: in-memory.
 */
export async function getPlanStatus(): Promise<PlanStatus> {
  if (isDemoActive()) {
    const count = demo.vehicles().length;
    const limit = PLAN_LIMIT[demoPlan];
    return {
      plan: demoPlan,
      status: 'active',
      vehicleCount: count,
      limit,
      canAdd: limit === null || count < limit,
      renewsAt: null,
      promoRemaining: 20,
      orgIsPromo: demoPlan !== 'free',
    };
  }

  // NOT: 'fleet_plan_status' RPC yeni; database.types.ts regenerate edilince
  // (`supabase gen types typescript`) bu 'as never' cast'i kaldırılabilir.
  const { data, error } = await supabase.rpc('fleet_plan_status' as never);
  if (error) throw error;
  const d = (data ?? {}) as Record<string, unknown>;
  const rawLimit = d.limit;
  return {
    plan: (d.plan as FleetPlan) ?? 'free',
    status: (d.status as string) ?? 'active',
    vehicleCount: Number(d.vehicle_count ?? 0),
    limit: rawLimit === null || rawLimit === undefined ? null : Number(rawLimit),
    canAdd: Boolean(d.can_add),
    renewsAt: (d.renews_at as string) ?? null,
    promoRemaining: Number(d.promo_remaining ?? 0),
    orgIsPromo: Boolean(d.org_is_promo),
    noOrg: Boolean(d.no_org),
  };
}

/**
 * Planı yükseltir. SUNUCU karar verir:
 *   sandbox (key yok) → ücretsiz aktive ('activated'); ilk-20 dolduysa 'promo_full'
 *   keys live         → 'redirect' (web/PayTR ödeme URL'i)
 * Demo: in-memory yükseltir.
 * NOT: Yalnızca owner çağırmalı (UI'da kontrol edilir); edge fn de owner doğrular.
 */
export async function upgradePlan(target: PayablePlan): Promise<UpgradeResult> {
  if (isDemoActive()) {
    demoPlan = target;
    return { status: 'activated', plan: target };
  }

  const { data, error } = await supabase.functions.invoke('fleet-subscribe', {
    body: { plan: target },
  });
  if (error) {
    return { status: 'error', message: error.message ?? 'upgrade_failed' };
  }
  const d = (data ?? {}) as { status?: string; url?: string };
  if (d.status === 'activated') return { status: 'activated', plan: target };
  if (d.status === 'redirect' && d.url) return { status: 'redirect', url: d.url };
  if (d.status === 'promo_full') return { status: 'promo_full' };
  return { status: 'error', message: 'unexpected_response' };
}

// Plan rozeti etiketi (marka adı, dilden bağımsız).
export function planLabel(plan: FleetPlan): string {
  return plan === 'pro_plus' ? 'Pro+' : plan === 'pro' ? 'Pro' : 'Free';
}

// Yükseltme hedefi: free→pro, pro→pro_plus, pro_plus→null (en üst).
export function nextPlan(plan: FleetPlan): PayablePlan | null {
  return plan === 'free' ? 'pro' : plan === 'pro' ? 'pro_plus' : null;
}

// Abonelik WEB'de yönetilir (promo bittiğinde / keys live).
export const UPGRADE_URL = 'https://www.drivermesh.com/abonelik';

/**
 * "Web'de Yükselt" hedefini AÇIK oturumla kur: access_token + hedef plan URL
 * fragment'inde (#access_token=...&plan=...) geçer. Fragment sunucuya gitmez;
 * web tarafı okuyup anında temizler ve otomatik authenticate olur — login olmuş
 * kullanıcı web'de tekrar login OLMAZ. Token alınamazsa düz URL'e düşer.
 */
export async function buildUpgradeUrl(target?: PayablePlan): Promise<string> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      const planPart = target ? `&plan=${target}` : '';
      return `${UPGRADE_URL}#access_token=${encodeURIComponent(token)}${planPart}`;
    }
  } catch {
    // oturum alınamadı → düz URL
  }
  return target ? `${UPGRADE_URL}#plan=${target}` : UPGRADE_URL;
}

// Sunucu trigger'ı limit aşımında bu mesajı fırlatır.
export const LIMIT_ERROR_TOKEN = 'vehicle_limit_reached';
