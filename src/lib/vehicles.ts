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

type VehiclePatch = Partial<Pick<Vehicle, 'plate' | 'brand' | 'model' | 'year' | 'status'>>;

export async function updateVehicle(id: string, patch: VehiclePatch) {
  const next: VehiclePatch = { ...patch };
  if (typeof patch.plate === 'string') {
    next.plate = patch.plate.toUpperCase().replace(/\s+/g, ' ').trim();
  }
  const { error } = await supabase.from('vehicles').update(next).eq('id', id);
  if (error) throw error;
}
