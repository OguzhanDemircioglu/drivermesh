import { useQuery } from '@tanstack/react-query';
import { getActiveRideDriverInfo, type DriverInfo } from '@/lib/db/driverInfo';

export function useActiveDriverInfo(rideRequestId: string | null | undefined) {
  return useQuery<DriverInfo | null>({
    queryKey: ['ride', 'active-driver-info', rideRequestId],
    queryFn: () => getActiveRideDriverInfo(rideRequestId!),
    enabled: !!rideRequestId,
    staleTime: 60 * 1000,
  });
}
