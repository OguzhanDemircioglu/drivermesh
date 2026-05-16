import { useQuery } from '@tanstack/react-query';
import { getPendingRatingRide } from '@/lib/db/rides';
import type { Database } from '@/lib/database.types';

type RideRequest = Database['public']['Tables']['ride_requests']['Row'];

/**
 * Son completed ride var ama henüz rate edilmediyse ride satırını döner.
 * 24 saatten eski ride'lar otomatik gizlenir.
 */
export function usePendingRating(customerId: string | undefined) {
  return useQuery<RideRequest | null>({
    queryKey: ['ride', 'pending-rating', customerId],
    queryFn: () => getPendingRatingRide(customerId!),
    enabled: !!customerId,
    staleTime: 30 * 1000,
  });
}
