// Gemini function calling tools — read-only fleet queries.
//
// Tasarim:
// - Tools sadece SELECT yapar. Action (create job, claim vehicle vs.) V0.3.
// - Executor caller'in user JWT'siyle authenticated supabase client uzerinden
//   calisir → RLS scope korunur. Yani driver sadece kendi scope'unu gorur,
//   manager kendi sofor altligini, owner tum org'u (Hierarchy Phase 2 RLS
//   policy'leri sayesinde transparent).
// - Gemini cevap json parse hatalarinda graceful fallback (string ozet
//   yerine "tool failed" gonder).

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

// ============================================================
// Tool declarations — Gemini function calling format
// ============================================================
export const TOOL_DECLARATIONS = [
  {
    name: 'get_fleet_stats',
    description:
      "Caller'in org'undaki filo durumunu ozetler: toplam arac sayisi, status'lere gore breakdown (idle/maintenance/on_trip), surucu durum dagilimi (active/break/off_duty), acik is sayisi. RLS sayesinde driver kendi kapsamini, manager kendi altligini, owner tum org'u gorur. Filo durumu sorulduğunda kullan.",
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'list_open_jobs',
    description:
      "Acik (open status) islerin en yenisinden 5 tanesini ozet halinde donder (plaka yok cunku is henuz atanmadi, sadece musteri adi + pickup/dropoff + olusturulma zamani). RLS uygular. Acik isler hangileri / kac tane var / ne icin sorulduğunda kullan.",
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'list_vehicles_in_maintenance',
    description:
      "Su an bakimda olan araclari listeler (plaka, marka+model, bakim sebebi, ne zamana kadar). RLS uygular. 'Bakim'da kim var', 'kac arac bakimda' tipi sorulara kullan.",
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];

// ============================================================
// Tool executor — Gemini'den gelen function call'u DB'ye cevirir
// ============================================================
export async function executeTool(
  client: SupabaseClient,
  name: string,
  _args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case 'get_fleet_stats':
      return getFleetStats(client);
    case 'list_open_jobs':
      return listOpenJobs(client);
    case 'list_vehicles_in_maintenance':
      return listVehiclesInMaintenance(client);
    default:
      return { error: `unknown tool: ${name}` };
  }
}

async function getFleetStats(client: SupabaseClient): Promise<unknown> {
  const [vehiclesRes, profilesRes, jobsRes] = await Promise.all([
    client.from('vehicles').select('id, status'),
    client.from('profiles').select('id, role, status'),
    client.from('jobs').select('id, status').eq('status', 'open'),
  ]);
  if (vehiclesRes.error) return { error: `vehicles: ${vehiclesRes.error.message}` };
  if (profilesRes.error) return { error: `profiles: ${profilesRes.error.message}` };
  if (jobsRes.error) return { error: `jobs: ${jobsRes.error.message}` };

  const vehicles = vehiclesRes.data ?? [];
  const drivers = (profilesRes.data ?? []).filter((p) => p.role === 'driver');
  const openJobs = jobsRes.data ?? [];

  const vehicleBreakdown: Record<string, number> = {};
  for (const v of vehicles) vehicleBreakdown[v.status] = (vehicleBreakdown[v.status] ?? 0) + 1;
  const driverBreakdown: Record<string, number> = {};
  for (const d of drivers) driverBreakdown[d.status] = (driverBreakdown[d.status] ?? 0) + 1;

  return {
    vehicles_total: vehicles.length,
    vehicles_by_status: vehicleBreakdown,
    drivers_total: drivers.length,
    drivers_by_status: driverBreakdown,
    open_jobs_total: openJobs.length,
  };
}

async function listOpenJobs(client: SupabaseClient): Promise<unknown> {
  const { data, error } = await client
    .from('jobs')
    .select('id, customer_name, pickup_address, dropoff_address, created_at')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(5);
  if (error) return { error: error.message };
  return { jobs: data ?? [] };
}

async function listVehiclesInMaintenance(client: SupabaseClient): Promise<unknown> {
  const { data, error } = await client
    .from('vehicles')
    .select('plate, brand, model, maintenance_reason, maintenance_until')
    .eq('status', 'maintenance')
    .order('maintenance_until', { ascending: true });
  if (error) return { error: error.message };
  return { vehicles: data ?? [] };
}
