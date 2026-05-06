import { supabase } from './supabase';
import type { Job, JobStatus, Profile, Vehicle } from './database.types';

export type JobWithRefs = Job & {
  vehicle: Pick<Vehicle, 'id' | 'plate' | 'brand' | 'model'> | null;
  driver: Pick<Profile, 'id' | 'full_name' | 'role'> | null;
  creator: Pick<Profile, 'full_name'> | null;
};

const SELECT =
  '*, vehicle:vehicles(id,plate,brand,model), driver:profiles!jobs_driver_id_fkey(id,full_name,role), creator:profiles!jobs_created_by_fkey(full_name)';

export async function listJobs(orgId: string): Promise<JobWithRefs[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select(SELECT)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as JobWithRefs[];
}

export async function listOpenJobs(orgId: string): Promise<JobWithRefs[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select(SELECT)
    .eq('organization_id', orgId)
    .eq('status', 'open')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as JobWithRefs[];
}

export async function listMyJobs(driverId: string): Promise<JobWithRefs[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select(SELECT)
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as JobWithRefs[];
}

export async function getJob(id: string): Promise<JobWithRefs | null> {
  const { data, error } = await supabase.from('jobs').select(SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as JobWithRefs) ?? null;
}

export async function listOrgDrivers(orgId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('organization_id', orgId)
    .eq('role', 'driver')
    .order('full_name');
  if (error) throw error;
  return data ?? [];
}

type CreateJobInput = {
  organizationId: string;
  createdBy: string;
  customerName: string;
  pickupAddress: string;
  dropoffAddress: string;
  distanceKm?: number | null;
  etaMinutes?: number | null;
  vehicleId?: string | null;
  driverId?: string | null;
  notes?: string | null;
};

export async function createJob(input: CreateJobInput): Promise<Job> {
  const status: JobStatus = input.driverId ? 'assigned' : 'open';
  const { data, error } = await supabase
    .from('jobs')
    .insert({
      organization_id: input.organizationId,
      created_by: input.createdBy,
      customer_name: input.customerName.trim(),
      pickup_address: input.pickupAddress.trim(),
      dropoff_address: input.dropoffAddress.trim(),
      distance_km: input.distanceKm ?? null,
      eta_minutes: input.etaMinutes ?? null,
      vehicle_id: input.vehicleId ?? null,
      driver_id: input.driverId ?? null,
      notes: input.notes?.trim() || null,
      status,
      assigned_at: input.driverId ? new Date().toISOString() : null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function simulateRideJob(): Promise<string> {
  const { data, error } = await supabase.rpc('simulate_ride_job');
  if (error) throw error;
  return data as string;
}

export async function acceptOpenJob(jobId: string, driverId: string): Promise<void> {
  const { data, error } = await supabase
    .from('jobs')
    .update({
      driver_id: driverId,
      status: 'assigned',
      assigned_at: new Date().toISOString(),
    })
    .eq('id', jobId)
    .eq('status', 'open')
    .is('driver_id', null)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('İş başka bir şoföre atanmış olabilir veya artık açık değil.');
  }
}

export async function startJob(jobId: string): Promise<void> {
  const { error } = await supabase
    .from('jobs')
    .update({ status: 'in_progress', started_at: new Date().toISOString() })
    .eq('id', jobId);
  if (error) throw error;
}

export async function completeJob(jobId: string): Promise<void> {
  const { error } = await supabase
    .from('jobs')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', jobId);
  if (error) throw error;
}

export async function failJob(jobId: string, reason: string): Promise<void> {
  const { error } = await supabase
    .from('jobs')
    .update({
      status: 'failed',
      fail_reason: reason.trim() || 'Belirtilmedi',
      completed_at: new Date().toISOString(),
    })
    .eq('id', jobId);
  if (error) throw error;
}

export async function cancelJob(jobId: string): Promise<void> {
  const { error } = await supabase.from('jobs').update({ status: 'cancelled' }).eq('id', jobId);
  if (error) throw error;
}

type JobEditPatch = Partial<
  Pick<
    Job,
    'customer_name' | 'pickup_address' | 'dropoff_address' | 'distance_km' | 'eta_minutes' | 'notes'
  >
>;

export async function updateJob(jobId: string, patch: JobEditPatch): Promise<void> {
  const next: JobEditPatch = { ...patch };
  if (typeof patch.customer_name === 'string') next.customer_name = patch.customer_name.trim();
  if (typeof patch.pickup_address === 'string') next.pickup_address = patch.pickup_address.trim();
  if (typeof patch.dropoff_address === 'string') next.dropoff_address = patch.dropoff_address.trim();
  if (typeof patch.notes === 'string') next.notes = patch.notes.trim() || null;
  const { error } = await supabase.from('jobs').update(next).eq('id', jobId);
  if (error) throw error;
}

export async function reassignJob(jobId: string, driverId: string | null): Promise<void> {
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from('jobs')
    .update({
      driver_id: driverId,
      assigned_at: driverId ? nowIso : null,
      status: driverId ? 'assigned' : 'open',
      started_at: null,
    })
    .eq('id', jobId);
  if (error) throw error;
}
