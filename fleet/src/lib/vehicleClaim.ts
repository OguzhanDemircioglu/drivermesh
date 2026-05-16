// ============================================================================
// Vehicle Claim / Release
// ----------------------------------------------------------------------------
// Bir kullanicinin "o anda hangi araca sahip oldugunu" izleyen claim/release
// sistemi.
//
// Kurallar (project_vehicle_claim memory):
// - 1 kullanici ayni anda 1 araca sahip. Yeni claim eski'yi otomatik birakir.
// - Baska kullanicinin uzerinde olan araci da claim edebilirsiniz; arac direkt
//   el degistirir (released_by_other reason ile log'a duser).
// - Aktif is (assigned/in_progress) baginda olan araclar listClaimable'dan
//   filtrelenir — iste olan arac baska kullaniciya gecmez.
// - Bakimdaki arac (status='maintenance') claim edilemez.
// ============================================================================
import { supabase } from './supabase';
import type { Vehicle } from './database.types';
import { demo, isDemoActive } from '@/demo/store';

export type ClaimReason = 'manual' | 'job_start' | 'transfer';

export async function claimVehicle(
  vehicleId: string,
  userId: string,
  reason: ClaimReason = 'manual',
): Promise<void> {
  if (isDemoActive()) {
    demo.claimVehicle(vehicleId, userId, reason);
    return;
  }
  const { error } = await supabase.rpc('claim_vehicle', {
    p_vehicle_id: vehicleId,
    p_reason: reason,
  });
  if (error) throw error;
}

export async function releaseVehicle(vehicleId: string, userId: string): Promise<void> {
  if (isDemoActive()) {
    demo.releaseVehicle(vehicleId, userId);
    return;
  }
  const { error } = await supabase.rpc('release_vehicle', { p_vehicle_id: vehicleId });
  if (error) throw error;
}

/** Mevcut kullanicinin uzerinde olan arac (yoksa null). */
export async function getMyVehicle(userId: string): Promise<Vehicle | null> {
  if (isDemoActive()) {
    return demo.vehicles().find((v) => v.current_user_id === userId) ?? null;
  }
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('current_user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as Vehicle | null) ?? null;
}

/**
 * Claim edilebilir araclar:
 *   - status != 'maintenance'
 *   - assigned/in_progress is'i olmayan araclar (is basinda olan claim edilemez)
 *
 * `excludeMine=true` ise kullanicinin kendi uzerindeki arac listeden cikarilir
 * (UI'da 'Uzerinde su an X var, baska al' butonu icin).
 */
export async function listClaimableVehicles(
  orgId: string,
  opts?: { excludeUserId?: string },
): Promise<Vehicle[]> {
  if (isDemoActive()) {
    // Aktif is'i olan vehicle_id'leri topla
    const busy = new Set(
      demo
        .jobs()
        .filter((j) => j.status === 'assigned' || j.status === 'in_progress')
        .map((j) => j.vehicle_id)
        .filter((id): id is string => !!id),
    );
    return demo
      .vehicles()
      .filter((v) => v.status !== 'maintenance')
      .filter((v) => !busy.has(v.id))
      .filter((v) => (opts?.excludeUserId ? v.current_user_id !== opts.excludeUserId : true));
  }
  // Prod: vehicles + jobs (assigned|in_progress) ayri sorgu, busy listesi cikar
  const [{ data: vehicles, error: vErr }, { data: busyJobs, error: jErr }] = await Promise.all([
    supabase
      .from('vehicles')
      .select('*')
      .eq('organization_id', orgId)
      .neq('status', 'maintenance')
      .order('plate'),
    supabase
      .from('jobs')
      .select('vehicle_id')
      .eq('organization_id', orgId)
      .in('status', ['assigned', 'in_progress'])
      .not('vehicle_id', 'is', null),
  ]);
  if (vErr) throw vErr;
  if (jErr) throw jErr;
  const busy = new Set((busyJobs ?? []).map((j) => j.vehicle_id).filter((x): x is string => !!x));
  return (vehicles ?? [])
    .filter((v) => !busy.has(v.id))
    .filter((v) => (opts?.excludeUserId ? v.current_user_id !== opts.excludeUserId : true)) as Vehicle[];
}
