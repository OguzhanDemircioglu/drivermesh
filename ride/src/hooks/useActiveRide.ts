import { useQuery } from '@tanstack/react-query';
import { getActiveRide } from '@/lib/db/rides';
import type { Database } from '@/lib/database.types';

type RideRequest = Database['public']['Tables']['ride_requests']['Row'];

/**
 * Aktif yolculuğu çek. V1'de Realtime channel yerine polling (3sn).
 * V2'de Supabase Realtime'a geçeriz; şu an StrictMode + double-mount race'lerinden
 * kaçınmak için polling yeterli (yolcunun aktif bekleme süreleri kısa).
 */
export function useActiveRide(customerId: string | undefined) {
  return useQuery<RideRequest | null>({
    queryKey: ['ride', 'active', customerId],
    queryFn: () => getActiveRide(customerId!),
    enabled: !!customerId,
    refetchInterval: 3 * 1000,
    refetchIntervalInBackground: false,
    staleTime: 1 * 1000,
  });
}
