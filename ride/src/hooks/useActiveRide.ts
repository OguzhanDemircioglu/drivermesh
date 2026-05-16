import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getActiveRide } from '@/lib/db/rides';
import type { Database } from '@/lib/database.types';

type RideRequest = Database['public']['Tables']['ride_requests']['Row'];

/**
 * Aktif yolculuğu çek. V1'de Realtime channel yerine polling (3sn).
 * V2'de Supabase Realtime'a geçeriz; şu an StrictMode + double-mount race'lerinden
 * kaçınmak için polling yeterli (yolcunun aktif bekleme süreleri kısa).
 *
 * AppState foreground'a dönünce + active ride null'a düşünce pending-rating
 * sorgusunu invalidate et — driver complete_ride çağırınca polling 3s içinde
 * boş döner, hemen pending banner'ı yakalayalım (eski 30s staleTime gecikmesi yoktur).
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

  const query = useQuery<RideRequest | null>({
    queryKey: ['ride', 'active', customerId],
    queryFn: () => getActiveRide(customerId!),
    enabled: !!customerId,
    refetchInterval: 3 * 1000,
    refetchIntervalInBackground: false,
    staleTime: 1 * 1000,
  });

  // Aktif ride null'a düştü (driver complete_ride veya cancel) → pending-rating
  // anında yenile. AppState invalidation foreground geçişlerini yakalıyor,
  // bu ref-based check foreground sürerken completion'ı yakalıyor.
  useEffect(() => {
    if (!customerId) return;
    if (prevDataRef.current && query.data === null) {
      qc.invalidateQueries({ queryKey: ['ride', 'pending-rating', customerId] });
    }
    prevDataRef.current = query.data;
  }, [query.data, customerId, qc]);

  return query;
}
