import { supabase } from './supabase';
import type { Job, JobSource, JobStatus, Profile, Vehicle } from './database.types';

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
