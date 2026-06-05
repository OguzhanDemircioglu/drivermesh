// Fleet plan / fiyat konfigürasyonu — SUNUCU tarafı tek kaynak.
// Araç limitleri DB'deki public.fleet_plan_vehicle_limit() ile AYNI tutulmalı.

export type FleetPlan = 'free' | 'pro' | 'pro_plus';
export type PayablePlan = 'pro' | 'pro_plus';

export interface PlanConfig {
  plan: PayablePlan;
  vehicleLimit: number | null; // null = sınırsız
  priceTRY: number;            // aylık, TL
  label: string;
}

const num = (v: string | undefined, d: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
};

export const PLANS: Record<PayablePlan, PlanConfig> = {
  pro: {
    plan: 'pro',
    vehicleLimit: 10,
    priceTRY: num(Deno.env.get('PRICE_PRO_TRY'), 1000),
    label: 'DriverMesh Pro (aylık)',
  },
  pro_plus: {
    plan: 'pro_plus',
    vehicleLimit: null,
    priceTRY: num(Deno.env.get('PRICE_PRO_PLUS_TRY'), 2000),
    label: 'DriverMesh Pro+ (aylık)',
  },
};

export function isPayablePlan(p: unknown): p is PayablePlan {
  return p === 'pro' || p === 'pro_plus';
}

// Keyler gelene kadar sandbox aktif: gerçek ödeme yok, plan anında aktive edilir.
export function isSandbox(): boolean {
  return (Deno.env.get('PAYMENTS_SANDBOX') ?? 'true').toLowerCase() !== 'false';
}
