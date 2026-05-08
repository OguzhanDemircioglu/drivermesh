import { supabase } from './supabase';
import type { Job, JobStatus, Profile, Vehicle } from './database.types';
import { DEMO_ORG_ID, demo, isDemoActive } from '@/demo/store';
import i18n from '@/i18n';

export type JobWithRefs = Job & {
  vehicle: Pick<Vehicle, 'id' | 'plate' | 'brand' | 'model'> | null;
  driver: Pick<Profile, 'id' | 'full_name' | 'role' | 'avatar_url'> | null;
  creator: Pick<Profile, 'full_name'> | null;
};

const SELECT =
  '*, vehicle:vehicles(id,plate,brand,model), driver:profiles!jobs_driver_id_fkey(id,full_name,role,avatar_url), creator:profiles!jobs_created_by_fkey(full_name)';

function inflate(j: Job): JobWithRefs {
  const v = j.vehicle_id ? demo.vehicleById(j.vehicle_id) : null;
  const d = j.driver_id ? demo.profileById(j.driver_id) : null;
  const c = demo.profileById(j.created_by);
  return {
    ...j,
    vehicle: v ? { id: v.id, plate: v.plate, brand: v.brand, model: v.model } : null,
    driver: d
      ? { id: d.id, full_name: d.full_name, role: d.role, avatar_url: d.avatar_url }
      : null,
    creator: c ? { full_name: c.full_name } : null,
  };
}

export async function listJobs(orgId: string): Promise<JobWithRefs[]> {
  if (isDemoActive()) return demo.jobs().map(inflate);

  const { data, error } = await supabase
    .from('jobs')
    .select(SELECT)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as JobWithRefs[];
}

export async function listOpenJobs(orgId: string): Promise<JobWithRefs[]> {
  if (isDemoActive()) {
    return demo
      .jobs()
      .filter((j) => j.status === 'open')
      .map(inflate);
  }
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
  if (isDemoActive()) {
    return demo
      .jobs()
      .filter((j) => j.driver_id === driverId)
      .map(inflate);
  }
  const { data, error } = await supabase
    .from('jobs')
    .select(SELECT)
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as JobWithRefs[];
}

export async function getJob(id: string): Promise<JobWithRefs | null> {
  if (isDemoActive()) {
    const j = demo.jobById(id);
    return j ? inflate(j) : null;
  }
  const { data, error } = await supabase.from('jobs').select(SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as JobWithRefs) ?? null;
}

export async function listOrgDrivers(orgId: string): Promise<Profile[]> {
  if (isDemoActive()) {
    return demo.profiles().filter((p) => p.role === 'driver');
  }
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
  pickupLat?: number | null;
  pickupLng?: number | null;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  distanceKm?: number | null;
  etaMinutes?: number | null;
  vehicleId?: string | null;
  driverId?: string | null;
  notes?: string | null;
  /** Channel of origin: internal (manual), ride (drivermesh ride), driver_request (driver self-logged) */
  source?: 'internal' | 'driver_request' | 'ride';
};

export async function createJob(input: CreateJobInput): Promise<Job> {
  const status: JobStatus = input.driverId ? 'assigned' : 'open';

  if (isDemoActive()) {
    const now = new Date().toISOString();
    const job: Job = {
      id: `demo-j-${Date.now()}`,
      organization_id: DEMO_ORG_ID,
      created_by: input.createdBy,
      customer_name: input.customerName.trim(),
      pickup_address: input.pickupAddress.trim(),
      dropoff_address: input.dropoffAddress.trim(),
      pickup_lat: input.pickupLat ?? null,
      pickup_lng: input.pickupLng ?? null,
      dropoff_lat: input.dropoffLat ?? null,
      dropoff_lng: input.dropoffLng ?? null,
      distance_km: input.distanceKm ?? null,
      eta_minutes: input.etaMinutes ?? null,
      vehicle_id: input.vehicleId ?? null,
      driver_id: input.driverId ?? null,
      notes: input.notes?.trim() || null,
      status,
      source: input.source ?? 'internal',
      created_at: now,
      assigned_at: input.driverId ? now : null,
      started_at: null,
      completed_at: null,
      fail_reason: null,
    };
    demo.addJob(job);
    return job;
  }

  const { data, error } = await supabase
    .from('jobs')
    .insert({
      organization_id: input.organizationId,
      created_by: input.createdBy,
      customer_name: input.customerName.trim(),
      pickup_address: input.pickupAddress.trim(),
      dropoff_address: input.dropoffAddress.trim(),
      pickup_lat: input.pickupLat ?? null,
      pickup_lng: input.pickupLng ?? null,
      dropoff_lat: input.dropoffLat ?? null,
      dropoff_lng: input.dropoffLng ?? null,
      distance_km: input.distanceKm ?? null,
      eta_minutes: input.etaMinutes ?? null,
      vehicle_id: input.vehicleId ?? null,
      driver_id: input.driverId ?? null,
      notes: input.notes?.trim() || null,
      status,
      source: input.source ?? 'internal',
      assigned_at: input.driverId ? new Date().toISOString() : null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function simulateRideJob(): Promise<string> {
  if (isDemoActive()) {
    // Demo: ride job — pickup Beşiktaş, dropoff Kadıköy
    const id = `demo-j-${Date.now()}`;
    const now = new Date().toISOString();
    demo.addJob({
      id,
      organization_id: DEMO_ORG_ID,
      created_by: 'demo-owner',
      customer_name: `Ride #${Math.floor(Math.random() * 9000 + 1000)}`,
      pickup_address: 'Beşiktaş İskele',
      pickup_lat: 41.0428,
      pickup_lng: 29.0085,
      dropoff_address: 'Kadıköy İskele',
      dropoff_lat: 40.9908,
      dropoff_lng: 29.0270,
      distance_km: 5.4,
      eta_minutes: 18,
      vehicle_id: null,
      driver_id: null,
      notes: null,
      status: 'open',
      source: 'ride',
      created_at: now,
      assigned_at: null,
      started_at: null,
      completed_at: null,
      fail_reason: null,
    });
    return id;
  }
  const { data, error } = await supabase.rpc('simulate_ride_job');
  if (error) throw error;
  return data as string;
}

export async function acceptOpenJob(jobId: string, driverId: string): Promise<void> {
  if (isDemoActive()) {
    const j = demo.jobById(jobId);
    if (!j || j.status !== 'open' || j.driver_id) {
      throw new Error(i18n.t('errors.jobAlreadyTaken'));
    }
    demo.updateJob(jobId, {
      driver_id: driverId,
      status: 'assigned',
      assigned_at: new Date().toISOString(),
    });
    return;
  }
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
    throw new Error(i18n.t('errors.jobAlreadyTaken'));
  }
}

export async function startJob(jobId: string): Promise<void> {
  if (isDemoActive()) {
    demo.updateJob(jobId, { status: 'in_progress', started_at: new Date().toISOString() });
    return;
  }
  const { error } = await supabase
    .from('jobs')
    .update({ status: 'in_progress', started_at: new Date().toISOString() })
    .eq('id', jobId);
  if (error) throw error;
}

export async function completeJob(jobId: string): Promise<void> {
  if (isDemoActive()) {
    demo.updateJob(jobId, { status: 'completed', completed_at: new Date().toISOString() });
    return;
  }
  const { error } = await supabase
    .from('jobs')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', jobId);
  if (error) throw error;
}

export async function failJob(jobId: string, reason: string): Promise<void> {
  if (isDemoActive()) {
    demo.updateJob(jobId, {
      status: 'failed',
      fail_reason: reason.trim() || 'Belirtilmedi',
      completed_at: new Date().toISOString(),
    });
    return;
  }
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
  if (isDemoActive()) {
    demo.updateJob(jobId, { status: 'cancelled' });
    return;
  }
  const { error } = await supabase.from('jobs').update({ status: 'cancelled' }).eq('id', jobId);
  if (error) throw error;
}

type JobEditPatch = Partial<
  Pick<
    Job,
    | 'customer_name'
    | 'pickup_address'
    | 'pickup_lat'
    | 'pickup_lng'
    | 'dropoff_address'
    | 'dropoff_lat'
    | 'dropoff_lng'
    | 'distance_km'
    | 'eta_minutes'
    | 'notes'
  >
>;

export async function updateJob(jobId: string, patch: JobEditPatch): Promise<void> {
  const next: JobEditPatch = { ...patch };
  if (typeof patch.customer_name === 'string') next.customer_name = patch.customer_name.trim();
  if (typeof patch.pickup_address === 'string') next.pickup_address = patch.pickup_address.trim();
  if (typeof patch.dropoff_address === 'string') next.dropoff_address = patch.dropoff_address.trim();
  if (typeof patch.notes === 'string') next.notes = patch.notes.trim() || null;

  if (isDemoActive()) {
    demo.updateJob(jobId, next as Partial<Job>);
    return;
  }
  const { error } = await supabase.from('jobs').update(next).eq('id', jobId);
  if (error) throw error;
}

/**
 * Approve a driver-self-request job: assign it back to the driver who
 * requested it (job.created_by). Called by owner/manager from the job
 * detail screen when the job is open + source='driver_request'.
 */
export async function approveDriverRequest(
  jobId: string,
  requesterId: string,
): Promise<void> {
  if (isDemoActive()) {
    const j = demo.jobById(jobId);
    if (!j || j.status !== 'open' || j.source !== 'driver_request') {
      throw new Error(i18n.t('errors.requestAlreadyHandled'));
    }
    demo.updateJob(jobId, {
      driver_id: requesterId,
      status: 'assigned',
      assigned_at: new Date().toISOString(),
    });
    return;
  }
  const { data, error } = await supabase
    .from('jobs')
    .update({
      driver_id: requesterId,
      status: 'assigned',
      assigned_at: new Date().toISOString(),
    })
    .eq('id', jobId)
    .eq('status', 'open')
    .eq('source', 'driver_request')
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error(i18n.t('errors.requestAlreadyHandled'));
  }
}

/**
 * Reject a driver-self-request job: mark it cancelled. The driver sees the
 * status change in their list. Reason is optional but recorded in fail_reason
 * so the requester gets context.
 */
export async function rejectDriverRequest(
  jobId: string,
  reason?: string,
): Promise<void> {
  const trimmed = reason?.trim();
  if (isDemoActive()) {
    demo.updateJob(jobId, {
      status: 'cancelled',
      fail_reason: trimmed || null,
    });
    return;
  }
  const { error } = await supabase
    .from('jobs')
    .update({
      status: 'cancelled',
      fail_reason: trimmed || null,
    })
    .eq('id', jobId)
    .eq('status', 'open')
    .eq('source', 'driver_request');
  if (error) throw error;
}

export async function reassignJob(jobId: string, driverId: string | null): Promise<void> {
  const nowIso = new Date().toISOString();
  if (isDemoActive()) {
    demo.updateJob(jobId, {
      driver_id: driverId,
      assigned_at: driverId ? nowIso : null,
      status: driverId ? 'assigned' : 'open',
      started_at: null,
    });
    return;
  }
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
