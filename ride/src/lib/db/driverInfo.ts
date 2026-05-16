import { supabase } from '@/lib/supabase';

export type DriverInfo = {
  driver_id: string;
  driver_name: string | null;
  driver_phone: string | null;
  driver_avatar_url: string | null;
  vehicle_id: string;
  plate: string;
  brand: string;
  model: string;
  color: string | null;
  photo_url: string | null;
  hq_lat: number | null;
  hq_lng: number | null;
};

/**
 * Active ride'a bağlı şoför+araç+org bilgilerini, müşteri RLS sınırlarını
 * aşmadan döner. Müşteri vehicles/profiles tablolarını direkt göremez,
 * RPC SECURITY DEFINER ile sınırlı veri alır.
 */
export async function getActiveRideDriverInfo(rideRequestId: string): Promise<DriverInfo | null> {
  const { data, error } = await supabase.rpc('ride_active_driver_info' as never, {
    p_ride_id: rideRequestId,
  } as never);
  if (error) throw error;
  return (data as DriverInfo[] | null)?.[0] ?? null;
}
