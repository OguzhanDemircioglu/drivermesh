CREATE OR REPLACE FUNCTION public.ride_active_driver_info(p_ride_id uuid)
RETURNS TABLE (
  driver_id uuid,
  driver_name text,
  driver_phone text,
  driver_avatar_url text,
  vehicle_id uuid,
  plate text,
  brand text,
  model text,
  color text,
  photo_url text,
  hq_lat double precision,
  hq_lng double precision
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id, p.full_name, p.phone, p.avatar_url,
    v.id, v.plate, v.brand, v.model, v.color, v.photo_url,
    o.hq_lat, o.hq_lng
  FROM public.ride_requests rr
  JOIN public.customers c ON c.id = rr.customer_id AND c.auth_user_id = auth.uid()
  JOIN public.vehicles v  ON v.id = rr.vehicle_id
  JOIN public.profiles p  ON p.id = rr.driver_id
  JOIN public.organizations o ON o.id = rr.organization_id
  WHERE rr.id = p_ride_id
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.ride_active_driver_info(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.ride_active_driver_info(uuid) TO authenticated;;
