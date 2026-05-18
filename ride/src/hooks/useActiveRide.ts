import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getActiveRide } from '@/lib/db/rides';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';

type RideRequest = Database['public']['Tables']['ride_requests']['Row'];

/**
 * Aktif yolculuğu çek. V0.2'de Supabase Realtime channel: ride_requests'te
 * customer'a ait herhangi bir değişim (status, ETA fields) anında query
 * invalidate eder. Polling 30sn fallback (Realtime kopma, kaybedilen event)
 * için açık tutuluyor.
 *
 * AppState foreground'a dönünce + active ride null'a düşünce pending-rating
 * sorgusunu invalidate et — driver complete_ride çağırınca realtime event
 * UI'ı anında günceller, hemen pending banner'ı yakalayalım.
 */
export function useActiveRide(customerId: string | undefined) {
  const qc = useQueryClient();
  const prevDataRef = useRef<RideRequest | null | undefined>(undefined);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || !customerId) return;
      qc.invalidateQueries({ queryKey: ['ride', 'active', customerId] });
      qc.invalidateQueries({ queryKey: ['ride', 'pending-rating', customerId] });
    });
    return () => sub.remove();
  }, [customerId, qc]);

  // Realtime: ride_requests'te customer'a ait herhangi bir change → invalidate.
  // Polling fallback 30sn (Realtime bağlantı koparsa state senkron kalsın).
  useEffect(() => {
    if (!customerId) return;
    const channel = supabase
      .channel(`ride-active-${customerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ride_requests',
          filter: `customer_id=eq.${customerId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ['ride', 'active', customerId] });
          qc.invalidateQueries({ queryKey: ['ride', 'pending-rating', customerId] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [customerId, qc]);

  const query = useQuery<RideRequest | null>({
    queryKey: ['ride', 'active', customerId],
    queryFn: () => getActiveRide(customerId!),
    enabled: !!customerId,
    refetchInterval: 30 * 1000,
    refetchIntervalInBackground: false,
    staleTime: 1 * 1000,
  });

  // Aktif ride null'a düştü (driver complete_ride veya cancel) → pending-rating
  // anında yenile. Realtime invalidation çoğu zaman bunu yakalar, bu ref-based
  // check arada kalan corner case'leri kapsar.
  useEffect(() => {
    if (!customerId) return;
    if (prevDataRef.current && query.data === null) {
      qc.invalidateQueries({ queryKey: ['ride', 'pending-rating', customerId] });
    }
    prevDataRef.current = query.data;
  }, [query.data, customerId, qc]);

  return query;
}
