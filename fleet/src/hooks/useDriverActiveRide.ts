import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { isDemoActive } from '@/demo/store';

export type DriverActiveRide = {
  id: string;
  status: 'searching' | 'assigned' | 'driver_arrived' | 'in_progress';
  pickup_address: string | null;
  customer_id: string;
  vehicle_id: string;
  requested_at: string;
  assigned_at: string | null;
  arrived_at: string | null;
  started_at: string | null;
  fare_estimate: number | null;
  fare_final: number | null;
  distance_km: number | null;
  duration_min: number | null;
};

export function useDriverActiveRide(driverId: string | undefined) {
  const [data, setData] = useState<DriverActiveRide | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!driverId) {
      setData(null);
      setLoading(false);
      return;
    }
    // Demo modunda Supabase yok — boş döndür, 3sn polling boşa
    // çağırılmasın.
    if (isDemoActive()) {
      setData(null);
      setLoading(false);
      return;
    }
    const { data: row, error } = await supabase
      .from('ride_requests' as never)
      .select(
        'id,status,pickup_address,customer_id,vehicle_id,requested_at,assigned_at,arrived_at,started_at,fare_estimate,fare_final,distance_km,duration_min',
      )
      .eq('driver_id', driverId)
      .in('status', ['searching', 'assigned', 'driver_arrived', 'in_progress'])
      .order('requested_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.warn('[driver-active-ride] error', error.message);
      setLoading(false);
      return;
    }
    setData((row as DriverActiveRide | null) ?? null);
    setLoading(false);
  }, [driverId]);

  useEffect(() => {
    load();
    if (!driverId) return;
    const id = setInterval(() => {
      void load();
    }, 3000);
    return () => clearInterval(id);
  }, [load, driverId]);

  return { data, loading, refetch: load };
}
