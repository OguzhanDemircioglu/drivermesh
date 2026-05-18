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

/**
 * V0.2: Supabase Realtime channel + 30sn polling fallback.
 * Driver'a atanan ride_requests satırındaki herhangi bir change anında load()
 * tetikler — customer çağırınca, driver_arrived/start/complete/cancel
 * transitions cihaza milisaniyeler içinde yansır.
 */
export function useDriverActiveRide(driverId: string | undefined) {
  const [data, setData] = useState<DriverActiveRide | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!driverId) {
      setData(null);
      setLoading(false);
      return;
    }
    // Demo modunda Supabase yok — boş döndür, fetch boşa çağırılmasın.
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
    void load();
    if (!driverId || isDemoActive()) return;

    // Realtime subscribe: bu driver'a ait herhangi bir ride_request change → reload
    const channel = supabase
      .channel(`driver-active-${driverId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ride_requests',
          filter: `driver_id=eq.${driverId}`,
        },
        () => {
          void load();
        },
      )
      .subscribe();

    // 30sn polling fallback (Realtime bağlantı kopması durumunda safety net)
    const intervalId = setInterval(() => {
      void load();
    }, 30000);

    return () => {
      clearInterval(intervalId);
      void supabase.removeChannel(channel);
    };
  }, [load, driverId]);

  return { data, loading, refetch: load };
}
