import { useQuery } from '@tanstack/react-query';
import { searchVehicles, type SearchVehiclesRow } from '@/lib/db/rides';

export function useNearbyVehicles(
  lat: number | undefined,
  lng: number | undefined,
  radiusKm = 30,
) {
  return useQuery<SearchVehiclesRow[]>({
    queryKey: ['ride', 'nearby-vehicles', lat, lng, radiusKm],
    queryFn: () => searchVehicles(lat!, lng!, radiusKm),
    enabled: lat != null && lng != null,
    // V1 polling: 30sn'de bir tazele (vehicles tab açıkken)
    refetchInterval: 30 * 1000,
    staleTime: 15 * 1000,
  });
}
