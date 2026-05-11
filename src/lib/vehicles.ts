import { supabase } from './supabase';
import type { Vehicle, VehicleStatus } from './database.types';
import { DEMO_ORG_ID, demo, isDemoActive } from '@/demo/store';

export type VehicleWithAdder = Vehicle & {
  added_by_profile: { full_name: string } | null;
};

function inflate(v: Vehicle): VehicleWithAdder {
  const adder = demo.profileById(v.added_by);
  return { ...v, added_by_profile: adder ? { full_name: adder.full_name } : null };
}

export async function listVehicles(orgId: string): Promise<VehicleWithAdder[]> {
  if (isDemoActive()) return demo.vehicles().map(inflate);

  const { data, error } = await supabase
    .from('vehicles')
    .select('*, added_by_profile:profiles!vehicles_added_by_fkey(full_name)')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as VehicleWithAdder[];
}

type CreateVehicleInput = {
  organizationId: string;
  addedBy: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  status?: VehicleStatus;
  photoUrl?: string | null;
  /** Hex colour (e.g. "#FF7A1A"). When null the UI falls back to the
   * plate-derived gradient. */
  color?: string | null;
};

export async function createVehicle(input: CreateVehicleInput): Promise<Vehicle> {
  const cleanedPlate = input.plate.toUpperCase().replace(/\s+/g, ' ').trim();

  if (isDemoActive()) {
    const v: Vehicle = {
      id: `demo-v-${Date.now()}`,
      organization_id: DEMO_ORG_ID,
      added_by: input.addedBy,
      plate: cleanedPlate,
      brand: input.brand.trim(),
      model: input.model.trim(),
      year: input.year,
      status: input.status ?? 'idle',
      photo_url: input.photoUrl ?? null,
      color: input.color ?? null,
      is_at_hq: true,
      maintenance_until: null,
      maintenance_started_at: null,
      maintenance_started_by: null,
      maintenance_reason: null,
      maintenance_photo_urls: [],
      current_user_id: null,
      created_at: new Date().toISOString(),
    };
    demo.addVehicle(v);
    return v;
  }

  const { data, error } = await supabase
    .from('vehicles')
    .insert({
      organization_id: input.organizationId,
      added_by: input.addedBy,
      plate: cleanedPlate,
      brand: input.brand.trim(),
      model: input.model.trim(),
      year: input.year,
      status: input.status ?? 'idle',
      photo_url: input.photoUrl ?? null,
      color: input.color ?? null,
      // New vehicles start parked at the logistics HQ — the fleet map hides
      // them until the operator hits "leaves HQ" (button on detail) OR a
      // job gets assigned (auto-clear via clear_at_hq_on_dispatch trigger).
      is_at_hq: true,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateVehicleStatus(id: string, status: VehicleStatus) {
  if (isDemoActive()) {
    demo.updateVehicle(id, { status });
    return;
  }
  const { error } = await supabase.from('vehicles').update({ status }).eq('id', id);
  if (error) throw error;
}

/**
 * Mark a vehicle as parked at the logistics HQ. The fleet map hides it
 * while this flag is true (the HQ marker stands in for it). The DB trigger
 * `clear_at_hq_on_dispatch` auto-clears the flag the moment a job is
 * assigned to the vehicle so the operator doesn't have to remember.
 */
export async function setVehicleAtHq(id: string, isAtHq: boolean) {
  if (isDemoActive()) {
    demo.updateVehicle(id, { is_at_hq: isAtHq });
    return;
  }
  const { error } = await supabase
    .from('vehicles')
    .update({ is_at_hq: isAtHq })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteVehicle(id: string) {
  if (isDemoActive()) {
    demo.deleteVehicle(id);
    return;
  }
  const { error } = await supabase.from('vehicles').delete().eq('id', id);
  if (error) throw error;
}

export async function getVehicle(id: string): Promise<VehicleWithAdder | null> {
  if (isDemoActive()) {
    const v = demo.vehicleById(id);
    return v ? inflate(v) : null;
  }
  const { data, error } = await supabase
    .from('vehicles')
    .select('*, added_by_profile:profiles!vehicles_added_by_fkey(full_name)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as VehicleWithAdder | null) ?? null;
}

export type VehicleJobLite = {
  id: string;
  customer_name: string;
  status: string;
  created_at: string;
  driver: { full_name: string } | null;
};

export async function listVehicleJobs(
  vehicleId: string,
  limit = 5,
): Promise<VehicleJobLite[]> {
  if (isDemoActive()) {
    return demo
      .jobs()
      .filter((j) => j.vehicle_id === vehicleId)
      .slice(0, limit)
      .map((j) => ({
        id: j.id,
        customer_name: j.customer_name,
        status: j.status,
        created_at: j.created_at,
        driver: j.driver_id
          ? { full_name: demo.profileById(j.driver_id)?.full_name ?? '—' }
          : null,
      }));
  }

  const { data, error } = await supabase
    .from('jobs')
    .select(
      'id, customer_name, status, created_at, driver:profiles!jobs_driver_id_fkey(full_name)',
    )
    .eq('vehicle_id', vehicleId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as VehicleJobLite[];
}

type VehiclePatch = Partial<Pick<Vehicle, 'plate' | 'brand' | 'model' | 'year' | 'status' | 'color'>> & {
  /** camelCase API: backend `photo_url`'e map'lenir. */
  photoUrl?: string | null;
};

export async function updateVehicle(id: string, patch: VehiclePatch) {
  // photoUrl camelCase olarak gelir; backend kolonu photo_url. Diğer kolonlar
  // zaten snake_case bekliyor (Vehicle tipinden).
  const { photoUrl, ...rest } = patch;
  const next: Partial<Vehicle> = { ...rest };
  if (typeof rest.plate === 'string') {
    next.plate = rest.plate.toUpperCase().replace(/\s+/g, ' ').trim();
  }
  if (photoUrl !== undefined) {
    next.photo_url = photoUrl;
  }
  if (isDemoActive()) {
    demo.updateVehicle(id, next);
    return;
  }
  const { error } = await supabase.from('vehicles').update(next).eq('id', id);
  if (error) throw error;
}
