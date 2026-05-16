import { useQuery } from '@tanstack/react-query';
import { getPendingRatingRide } from '@/lib/db/rides';
import type { Database } from '@/lib/database.types';

type RideRequest = Database['public']['Tables']['ride_requests']['Row'];

/**
 * Son completed ride var ama henüz rate edilmediyse ride satırını döner.
 * 24 saatten eski ride'lar otomatik gizlenir.
 *
 * staleTime 5s tutuyoruz çünkü ride tamamlanıp customer cold-reopen yaparsa
 * eski 30s cache pending banner'ı geciktiriyordu. AppState foreground listener
 * ile invalidate de ekleniyor.
 */
export function usePendingRating(customerId: string | undefined) {
  return useQuery<RideRequest | null>({
    queryKey: ['ride', 'pending-rating', customerId],
    queryFn: () => getPendingRatingRide(customerId!),
    enabled: !!customerId,
    staleTime: 5 * 1000,
  });
}
