import { supabase } from '@/lib/supabase';

export type CustomerStats = {
  totalRides: number;
  totalKm: number;
  lastRideAt: string | null;
  avgRating: number | null;
};

export async function getMyStats(customerId: string): Promise<CustomerStats> {
  // customers tablosunda total_rides, last_ride_at, avg_rating var (fleet trigger'ı veya tetiklendiğinde doldurur).
  // Toplam km için completed ride'ları topla.
  const [{ data: c, error: e1 }, { data: rides, error: e2 }] = await Promise.all([
    supabase
      .from('customers')
      .select('total_rides, last_ride_at, avg_rating')
      .eq('id', customerId)
      .maybeSingle(),
    supabase
      .from('ride_requests')
      .select('distance_km')
      .eq('customer_id', customerId)
      .eq('status', 'completed'),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const totalKm = (rides ?? []).reduce(
    (acc, r) => acc + (Number(r.distance_km) || 0),
    0,
  );

  return {
    totalRides: c?.total_rides ?? 0,
    totalKm: Math.round(totalKm * 10) / 10,
    lastRideAt: c?.last_ride_at ?? null,
    avgRating: c?.avg_rating != null ? Number(c.avg_rating) : null,
  };
}
