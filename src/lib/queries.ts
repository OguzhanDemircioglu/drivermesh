import { supabase } from './supabase';
import type { Job, JobSource, JobStatus, Profile, Vehicle, VehicleStatus } from './database.types';

export type HomeStats = {
  vehiclesTotal: number;
  vehiclesActive: number;
  teamCount: number;
  pendingInvitations: number;
  jobsToday: number;
  jobsOpen: number;
  jobsInProgress: number;
  jobsCompletedToday: number;
  todaysJobs: Array<Job & { driver: Pick<Profile, 'full_name'> | null }>;
};

export async function fetchHomeStats(): Promise<HomeStats> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const isoStartOfDay = startOfDay.toISOString();

  const [
    vehiclesRes,
    activeVehiclesRes,
    teamRes,
    pendingInvRes,
    todaysJobsRes,
    openJobsRes,
    inProgressJobsRes,
    completedTodayRes,
    todaysJobsListRes,
  ] = await Promise.all([
    supabase.from('vehicles').select('id', { count: 'exact', head: true }),
    supabase
      .from('vehicles')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase
      .from('invitations')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', isoStartOfDay),
    supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open'),
    supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'in_progress'),
    supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('completed_at', isoStartOfDay),
    supabase
      .from('jobs')
      .select('*, driver:profiles!jobs_driver_id_fkey(full_name)')
      .gte('created_at', isoStartOfDay)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const errors = [
    vehiclesRes.error,
    activeVehiclesRes.error,
    teamRes.error,
    pendingInvRes.error,
    todaysJobsRes.error,
    openJobsRes.error,
    inProgressJobsRes.error,
    completedTodayRes.error,
    todaysJobsListRes.error,
  ].filter(Boolean);
  if (errors.length) {
    console.warn('[fetchHomeStats] partial errors', errors.map((e) => e?.message));
  }

  return {
    vehiclesTotal: vehiclesRes.count ?? 0,
    vehiclesActive: activeVehiclesRes.count ?? 0,
    teamCount: teamRes.count ?? 0,
    pendingInvitations: pendingInvRes.count ?? 0,
    jobsToday: todaysJobsRes.count ?? 0,
    jobsOpen: openJobsRes.count ?? 0,
    jobsInProgress: inProgressJobsRes.count ?? 0,
    jobsCompletedToday: completedTodayRes.count ?? 0,
    todaysJobs: (todaysJobsListRes.data ?? []) as HomeStats['todaysJobs'],
  };
}

// ============================================================
// Reports (last 30 days)
// ============================================================

export type ReportStats = {
  rangeDays: number;
  totalJobs: number;
  byStatus: Record<JobStatus, number>;
  bySource: Record<JobSource, number>;
  topDrivers: Array<{ id: string; name: string; completed: number; failed: number }>;
  topVehicles: Array<{ id: string; plate: string; brand: string; model: string; jobs: number }>;
  totalDistanceKm: number;
  averageDistanceKm: number | null;
};

export async function fetchReportStats(rangeDays = 30): Promise<ReportStats> {
  const since = new Date();
  since.setDate(since.getDate() - rangeDays);
  const isoSince = since.toISOString();

  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('id, status, source, distance_km, driver_id, vehicle_id')
    .gte('created_at', isoSince);

  if (error) {
    console.warn('[fetchReportStats]', error.message);
    return {
      rangeDays,
      totalJobs: 0,
      byStatus: { open: 0, assigned: 0, in_progress: 0, completed: 0, failed: 0, cancelled: 0 },
      bySource: { internal: 0, driver_request: 0, ride: 0 },
      topDrivers: [],
      topVehicles: [],
      totalDistanceKm: 0,
      averageDistanceKm: null,
    };
  }

  const list = jobs ?? [];
  const byStatus: Record<JobStatus, number> = {
    open: 0, assigned: 0, in_progress: 0, completed: 0, failed: 0, cancelled: 0,
  };
  const bySource: Record<JobSource, number> = { internal: 0, driver_request: 0, ride: 0 };
  const driverAgg = new Map<string, { completed: number; failed: number }>();
  const vehicleAgg = new Map<string, number>();
  let totalDistance = 0;
  let distanceSamples = 0;

  for (const j of list) {
    byStatus[j.status as JobStatus]++;
    bySource[j.source as JobSource]++;
    if (j.driver_id) {
      const cur = driverAgg.get(j.driver_id) ?? { completed: 0, failed: 0 };
      if (j.status === 'completed') cur.completed++;
      if (j.status === 'failed') cur.failed++;
      driverAgg.set(j.driver_id, cur);
    }
    if (j.vehicle_id) {
      vehicleAgg.set(j.vehicle_id, (vehicleAgg.get(j.vehicle_id) ?? 0) + 1);
    }
    if (typeof j.distance_km === 'number') {
      totalDistance += j.distance_km;
      distanceSamples++;
    }
  }

  const driverIds = [...driverAgg.keys()];
  const vehicleIds = [...vehicleAgg.keys()];

  const [driversRes, vehiclesRes] = await Promise.all([
    driverIds.length
      ? supabase.from('profiles').select('id, full_name').in('id', driverIds)
      : Promise.resolve({ data: [] as Pick<Profile, 'id' | 'full_name'>[], error: null }),
    vehicleIds.length
      ? supabase.from('vehicles').select('id, plate, brand, model').in('id', vehicleIds)
      : Promise.resolve({ data: [] as Pick<Vehicle, 'id' | 'plate' | 'brand' | 'model'>[], error: null }),
  ]);

  const driverMap = new Map((driversRes.data ?? []).map((p) => [p.id, p.full_name]));
  const vehicleMap = new Map(
    (vehiclesRes.data ?? []).map((v) => [v.id, { plate: v.plate, brand: v.brand, model: v.model }]),
  );

  const topDrivers = [...driverAgg.entries()]
    .map(([id, agg]) => ({ id, name: driverMap.get(id) ?? '—', ...agg }))
    .sort((a, b) => b.completed + b.failed - (a.completed + a.failed))
    .slice(0, 5);

  const topVehicles = [...vehicleAgg.entries()]
    .map(([id, jobs]) => {
      const v = vehicleMap.get(id);
      return { id, plate: v?.plate ?? '—', brand: v?.brand ?? '', model: v?.model ?? '', jobs };
    })
    .sort((a, b) => b.jobs - a.jobs)
    .slice(0, 5);

  return {
    rangeDays,
    totalJobs: list.length,
    byStatus,
    bySource,
    topDrivers,
    topVehicles,
    totalDistanceKm: Math.round(totalDistance * 10) / 10,
    averageDistanceKm: distanceSamples ? Math.round((totalDistance / distanceSamples) * 10) / 10 : null,
  };
}

// ============================================================
// Fleet map snapshot — HQ + vehicles + their estimated current positions
// ============================================================

export type FleetMapVehicle = {
  id: string;
  plate: string;
  brand: string;
  model: string;
  status: VehicleStatus;
  /** Operator-chosen colour (hex). null → fall back to plate-derived hash. */
  color: string | null;
  /** Operator marked the vehicle as parked at HQ — fleet map hides it
   * so the HQ marker stands in for it. Auto-cleared on dispatch. */
  isAtHq: boolean;
  /** Estimated position: midpoint of active job route, or HQ */
  position: { lat: number; lng: number } | null;
  /** Active assigned/in_progress job summary (if any) */
  activeJob: {
    id: string;
    customerName: string;
    status: JobStatus;
    pickup: { lat: number; lng: number } | null;
    dropoff: { lat: number; lng: number } | null;
    /** Free-text labels — used on pickup/dropoff markers and as subline. */
    pickupAddress: string | null;
    dropoffAddress: string | null;
    driverName: string | null;
    /** ISO timestamp when the driver hit "İşi başlat"; null until in_progress */
    startedAt: string | null;
  } | null;
};

export type FleetMapSnapshot = {
  hq: { lat: number; lng: number; address: string | null } | null;
  vehicles: FleetMapVehicle[];
};

export async function fetchFleetMap(orgId: string): Promise<FleetMapSnapshot> {
  const [orgRes, vehiclesRes, activeJobsRes] = await Promise.all([
    supabase
      .from('organizations')
      .select('hq_lat, hq_lng, hq_address')
      .eq('id', orgId)
      .maybeSingle(),
    supabase
      .from('vehicles')
      .select('id, plate, brand, model, status, is_at_hq, color')
      .eq('organization_id', orgId)
      .order('plate'),
    supabase
      .from('jobs')
      .select(
        'id, customer_name, status, vehicle_id, driver_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, pickup_address, dropoff_address, started_at, driver:profiles!jobs_driver_id_fkey(full_name)',
      )
      .eq('organization_id', orgId)
      .in('status', ['assigned', 'in_progress'] satisfies JobStatus[]),
  ]);

  const hq =
    orgRes.data && orgRes.data.hq_lat != null && orgRes.data.hq_lng != null
      ? {
          lat: orgRes.data.hq_lat,
          lng: orgRes.data.hq_lng,
          address: orgRes.data.hq_address,
        }
      : null;

  const activeJobs = (activeJobsRes.data ?? []) as Array<{
    id: string;
    customer_name: string;
    status: JobStatus;
    vehicle_id: string | null;
    driver_id: string | null;
    pickup_lat: number | null;
    pickup_lng: number | null;
    dropoff_lat: number | null;
    dropoff_lng: number | null;
    pickup_address: string | null;
    dropoff_address: string | null;
    started_at: string | null;
    driver: { full_name: string } | null;
  }>;

  const jobByVehicle = new Map<string, (typeof activeJobs)[number]>();
  for (const j of activeJobs) {
    if (j.vehicle_id) jobByVehicle.set(j.vehicle_id, j);
  }

  const vehicles: FleetMapVehicle[] = (vehiclesRes.data ?? []).map((v) => {
    const job = jobByVehicle.get(v.id) ?? null;
    let position: FleetMapVehicle['position'] = hq ? { lat: hq.lat, lng: hq.lng } : null;
    let activeJob: FleetMapVehicle['activeJob'] = null;
    if (job) {
      const pickup =
        job.pickup_lat != null && job.pickup_lng != null
          ? { lat: job.pickup_lat, lng: job.pickup_lng }
          : null;
      const dropoff =
        job.dropoff_lat != null && job.dropoff_lng != null
          ? { lat: job.dropoff_lat, lng: job.dropoff_lng }
          : null;
      activeJob = {
        id: job.id,
        customerName: job.customer_name,
        status: job.status,
        pickup,
        dropoff,
        pickupAddress: job.pickup_address,
        dropoffAddress: job.dropoff_address,
        driverName: job.driver?.full_name ?? null,
        startedAt: job.started_at,
      };
      if (job.status === 'in_progress' && pickup && dropoff) {
        position = {
          lat: (pickup.lat + dropoff.lat) / 2,
          lng: (pickup.lng + dropoff.lng) / 2,
        };
      } else if (pickup) {
        position = pickup;
      }
    }
    return {
      id: v.id,
      plate: v.plate,
      brand: v.brand,
      model: v.model,
      status: v.status as VehicleStatus,
      color: (v as { color: string | null }).color ?? null,
      isAtHq: !!v.is_at_hq,
      position,
      activeJob,
    };
  });

  return { hq, vehicles };
}

// Silence unused-import warning for narrowing helpers
export type { JobSource };
