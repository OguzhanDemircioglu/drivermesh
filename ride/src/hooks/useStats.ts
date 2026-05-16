import { useQuery } from '@tanstack/react-query';
import { getMyStats, type CustomerStats } from '@/lib/db/stats';

export function useMyStats(customerId: string | undefined) {
  return useQuery<CustomerStats>({
    queryKey: ['stats', customerId],
    queryFn: () => getMyStats(customerId!),
    enabled: !!customerId,
    staleTime: 60 * 1000,
  });
}
