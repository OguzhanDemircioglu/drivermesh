import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';

export type RideRequest = Database['public']['Tables']['ride_requests']['Row'];

export type SearchVehiclesRow = {
  vehicle_id: string;
  organization_id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  color: string | null;
  photo_url: string | null;
  driver_id: string;
  driver_name: string | null;
  driver_avatar_url: string | null;
  driver_phone: string | null;
  hq_lat: number | null;
  hq_lng: number | null;
  hq_address: string | null;
  distance_km: number;
};

export async function searchVehicles(
  lat: number,
  lng: number,
  radiusKm = 30,
): Promise<SearchVehiclesRow[]> {
  const { data, error } = await supabase.rpc('ride_search_vehicles' as never, {
    p_lat: lat,
    p_lng: lng,
    p_radius_km: radiusKm,
  } as never);
  if (error) throw error;
  return (data ?? []) as SearchVehiclesRow[];
}

export async function requestRide(input: {
  vehicleId: string;
  pickupLng: number;
  pickupLat: number;
  pickupAddress: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('request_ride' as never, {
    p_vehicle_id: input.vehicleId,
    p_pickup_lng: input.pickupLng,
    p_pickup_lat: input.pickupLat,
    p_pickup_address: input.pickupAddress,
  } as never);
  if (error) throw error;
  return data as unknown as string;
}

export async function cancelRide(rideId: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_ride' as never, {
    p_ride_id: rideId,
    p_reason: reason ?? null,
  } as never);
  if (error) throw error;
}

export async function submitRating(input: {
  rideId: string;
  stars: number;
  comment?: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc('submit_rating' as never, {
    p_ride_id: input.rideId,
    p_stars: input.stars,
    p_comment: input.comment ?? null,
  } as never);
  if (error) throw error;
  return data as unknown as string;
}

export async function getActiveRide(customerId: string): Promise<RideRequest | null> {
  const { data, error } = await supabase
    .from('ride_requests')
    .select('*')
    .eq('customer_id', customerId)
    .in('status', ['searching', 'assigned', 'driver_arrived', 'in_progress'])
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listMyRides(customerId: string, limit = 20): Promise<RideRequest[]> {
  const { data, error } = await supabase
    .from('ride_requests')
    .select('*')
    .eq('customer_id', customerId)
    .order('requested_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getRide(rideId: string): Promise<RideRequest | null> {
  const { data, error } = await supabase
    .from('ride_requests')
    .select('*')
    .eq('id', rideId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getPendingRatingRide(
  customerId: string,
): Promise<RideRequest | null> {
  // Son completed ride'ı çek; varsa ratings'ı kontrol et.
  const { data: last, error } = await supabase
    .from('ride_requests')
    .select('*')
    .eq('customer_id', customerId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!last) return null;

  // 24 saatten eski ise hatırlatma yok
  if (last.completed_at) {
    const completedMs = new Date(last.completed_at).getTime();
    if (Date.now() - completedMs > 24 * 60 * 60 * 1000) return null;
  }

  const { data: rated, error: e2 } = await supabase
    .from('ratings')
    .select('id')
    .eq('ride_request_id', last.id)
    .eq('rater_type', 'customer')
    .maybeSingle();
  if (e2) throw e2;

  return rated ? null : last;
}
