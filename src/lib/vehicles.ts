import { supabase } from './supabase';
import type { Vehicle, VehicleStatus } from './database.types';

export type VehicleWithAdder = Vehicle & {
  added_by_profile: { full_name: string } | null;
};

export async function listVehicles(orgId: string): Promise<VehicleWithAdder[]> {
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
  const { data, error } = await supabase
    .from('vehicles')
    .insert({
      organization_id: input.organizationId,
      added_by: input.addedBy,
      plate: input.plate.toUpperCase().replace(/\s+/g, ' ').trim(),
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
  const { error } = await supabase
    .from('vehicles')
    .update({ is_at_hq: isAtHq })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteVehicle(id: string) {
  const { error } = await supabase.from('vehicles').delete().eq('id', id);
  if (error) throw error;
}

export async function getVehicle(id: string): Promise<VehicleWithAdder | null> {
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

type VehiclePatch = Partial<Pick<Vehicle, 'plate' | 'brand' | 'model' | 'year' | 'status' | 'color'>>;

export async function updateVehicle(id: string, patch: VehiclePatch) {
  const next: VehiclePatch = { ...patch };
  if (typeof patch.plate === 'string') {
    next.plate = patch.plate.toUpperCase().replace(/\s+/g, ' ').trim();
  }
  const { error } = await supabase.from('vehicles').update(next).eq('id', id);
  if (error) throw error;
}
