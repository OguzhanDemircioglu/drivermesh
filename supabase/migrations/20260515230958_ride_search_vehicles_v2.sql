-- ride_search_vehicles v2:
-- 1. fleet ride_enabled (var)
-- 2. is_fleet_open (mesai saatleri, YENİ)
-- 3. current_user_id NOT NULL (var)
-- 4. profile.role='driver' (YENİ — owner üstündeki araç gizli)
-- 5. profile.status='active' (YENİ — mola/off_duty/on_trip/unavailable hariç)
-- 6. vehicle.status='idle' (var)
-- 7. maintenance_started_at IS NULL (var)
-- 8. NOT EXISTS active ride (YENİ — savunma katmanı)
-- 9. service area / geo (var)
CREATE OR REPLACE FUNCTION public.ride_search_vehicles(
  p_lat double precision,
  p_lng double precision,
  p_radius_km integer DEFAULT 30
)
RETURNS TABLE(
  vehicle_id uuid,
  organization_id uuid,
  plate text, brand text, model text, year integer, color text, photo_url text,
  driver_id uuid, driver_name text, driver_avatar_url text, driver_phone text,
  hq_lat double precision, hq_lng double precision, hq_address text,
  distance_km numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    v.id              AS vehicle_id,
    v.organization_id AS organization_id,
    v.plate, v.brand, v.model, v.year, v.color, v.photo_url,
    p.id              AS driver_id,
    p.full_name       AS driver_name,
    p.avatar_url      AS driver_avatar_url,
    p.phone           AS driver_phone,
    o.hq_lat, o.hq_lng, o.hq_address,
    ROUND(
      (public.ST_Distance(
        public.ST_SetSRID(public.ST_MakePoint(o.hq_lng, o.hq_lat), 4326)::public.geography,
        public.ST_SetSRID(public.ST_MakePoint(p_lng, p_lat), 4326)::public.geography
      ) / 1000.0)::numeric, 2
    )                  AS distance_km
  FROM public.vehicles v
  JOIN public.fleets_visibility fv ON fv.organization_id = v.organization_id AND fv.ride_enabled = true
  JOIN public.organizations o      ON o.id = v.organization_id
  JOIN public.profiles p           ON p.id = v.current_user_id
  WHERE v.status = 'idle'
    AND v.current_user_id IS NOT NULL
    AND v.maintenance_started_at IS NULL
    AND p.role = 'driver'
    AND p.status = 'active'
    AND public.is_fleet_open(v.organization_id) = true
    AND NOT EXISTS (
      SELECT 1 FROM public.ride_requests rr
      WHERE rr.vehicle_id = v.id
        AND rr.status IN ('searching','assigned','driver_arrived','in_progress')
    )
    AND o.hq_lat IS NOT NULL AND o.hq_lng IS NOT NULL
    AND public.ST_DWithin(
      public.ST_SetSRID(public.ST_MakePoint(o.hq_lng, o.hq_lat), 4326)::public.geography,
      public.ST_SetSRID(public.ST_MakePoint(p_lng, p_lat), 4326)::public.geography,
      p_radius_km * 1000
    )
  ORDER BY distance_km ASC
  LIMIT 50;
$function$;;
