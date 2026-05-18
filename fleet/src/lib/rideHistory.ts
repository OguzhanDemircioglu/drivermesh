// Ride history — driver'ın geçmiş ride-source job'larını listeler.
// `jobs.source = 'ride'` filtreyle, demo aware.

import { supabase } from './supabase';
import { demo, isDemoActive } from '@/demo/store';
import type { Job } from './database.types';

export type RideHistoryItem = {
  id: string;
  customer_name: string;
  pickup_address: string | null;
  dropoff_address: string | null;
  distance_km: number | null;
  status: Job['status'];
  created_at: string;
  completed_at: string | null;
  fail_reason: string | null;
};

export async function listMyRides(driverId: string): Promise<RideHistoryItem[]> {
  if (isDemoActive()) {
    return demo
      .jobs()
      .filter((j) => j.source === 'ride' && j.driver_id === driverId)
      .map((j) => ({
        id: j.id,
        customer_name: j.customer_name,
        pickup_address: j.pickup_address,
        dropoff_address: j.dropoff_address,
        distance_km: j.distance_km != null ? Number(j.distance_km) : null,
        status: j.status,
        created_at: j.created_at,
        completed_at: j.completed_at,
        fail_reason: j.fail_reason,
      }));
  }

  const { data, error } = await supabase
    .from('jobs')
    .select(
      'id, customer_name, pickup_address, dropoff_address, distance_km, status, created_at, completed_at, fail_reason',
    )
    .eq('driver_id', driverId)
    .eq('source', 'ride')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as RideHistoryItem[];
}
