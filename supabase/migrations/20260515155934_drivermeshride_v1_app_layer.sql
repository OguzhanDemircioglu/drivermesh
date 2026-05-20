-- DriverMesh Ride V1 — app layer (RPC'ler + nullable migrations)
-- PostGIS public schema'da kurulu; extensions.* prefix'i yok.

-- M1: dropoff nullable
ALTER TABLE public.ride_requests ALTER COLUMN dropoff_address DROP NOT NULL;
ALTER TABLE public.ride_requests ALTER COLUMN dropoff_point   DROP NOT NULL;
ALTER TABLE public.ride_requests ALTER COLUMN fare_estimate   DROP NOT NULL;

-- M2: ride_search_vehicles
CREATE OR REPLACE FUNCTION public.ride_search_vehicles(
  p_lat double precision,
  p_lng double precision,
  p_radius_km integer DEFAULT 30
)
RETURNS TABLE (
  vehicle_id uuid,
  organization_id uuid,
  plate text,
  brand text,
  model text,
  year int,
  color text,
  photo_url text,
  driver_id uuid,
  driver_name text,
  driver_avatar_url text,
  driver_phone text,
  hq_lat double precision,
  hq_lng double precision,
  hq_address text,
  distance_km numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
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
    AND o.hq_lat IS NOT NULL AND o.hq_lng IS NOT NULL
    AND public.ST_DWithin(
      public.ST_SetSRID(public.ST_MakePoint(o.hq_lng, o.hq_lat), 4326)::public.geography,
      public.ST_SetSRID(public.ST_MakePoint(p_lng, p_lat), 4326)::public.geography,
      p_radius_km * 1000
    )
  ORDER BY distance_km ASC
  LIMIT 50;
$$;

REVOKE EXECUTE ON FUNCTION public.ride_search_vehicles(double precision, double precision, integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.ride_search_vehicles(double precision, double precision, integer) TO authenticated;

-- M3: request_ride
CREATE OR REPLACE FUNCTION public.request_ride(
  p_vehicle_id uuid,
  p_pickup_lng double precision,
  p_pickup_lat double precision,
  p_pickup_address text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
  v_blocked boolean;
  v_driver_id uuid;
  v_org_id uuid;
  v_ride_id uuid;
BEGIN
  SELECT id, blocked INTO v_customer_id, v_blocked
  FROM public.customers
  WHERE auth_user_id = auth.uid();

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'T4: customer profile missing';
  END IF;
  IF v_blocked IS TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'T4: customer blocked';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ride_requests
    WHERE customer_id = v_customer_id
      AND status IN ('searching','assigned','driver_arrived','in_progress')
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'T7: active ride exists';
  END IF;

  SELECT v.current_user_id, v.organization_id
    INTO v_driver_id, v_org_id
  FROM public.vehicles v
  WHERE v.id = p_vehicle_id
    AND v.status = 'idle'
    AND v.current_user_id IS NOT NULL
    AND v.maintenance_started_at IS NULL
  FOR UPDATE;

  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'T3: vehicle unavailable';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.fleets_visibility
    WHERE organization_id = v_org_id AND ride_enabled = true
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'T6: fleet ride disabled';
  END IF;

  INSERT INTO public.ride_requests (
    customer_id, vehicle_id, driver_id, organization_id,
    pickup_point, pickup_address,
    status, payment_method, assigned_at
  ) VALUES (
    v_customer_id, p_vehicle_id, v_driver_id, v_org_id,
    public.ST_SetSRID(public.ST_MakePoint(p_pickup_lng, p_pickup_lat), 4326)::public.geography,
    p_pickup_address,
    'assigned', 'cash', now()
  )
  RETURNING id INTO v_ride_id;

  RETURN v_ride_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_ride(uuid, double precision, double precision, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.request_ride(uuid, double precision, double precision, text) TO authenticated;

-- M4: cancel_ride
CREATE OR REPLACE FUNCTION public.cancel_ride(
  p_ride_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
BEGIN
  SELECT id INTO v_customer_id FROM public.customers WHERE auth_user_id = auth.uid();
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'T4: customer profile missing';
  END IF;

  UPDATE public.ride_requests
     SET status = 'cancelled_by_customer',
         cancel_reason = p_reason,
         cancelled_at = now()
   WHERE id = p_ride_id
     AND customer_id = v_customer_id
     AND status IN ('searching','assigned','driver_arrived','in_progress');

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Cannot cancel: ride not active or not yours';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_ride(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.cancel_ride(uuid, text) TO authenticated;

-- M5: submit_rating
CREATE OR REPLACE FUNCTION public.submit_rating(
  p_ride_id uuid,
  p_stars int,
  p_comment text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
  v_driver_id uuid;
  v_existing uuid;
  v_rating_id uuid;
BEGIN
  IF p_stars < 1 OR p_stars > 5 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'stars must be 1..5';
  END IF;

  SELECT id INTO v_customer_id FROM public.customers WHERE auth_user_id = auth.uid();
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'T4: customer profile missing';
  END IF;

  SELECT driver_id INTO v_driver_id
  FROM public.ride_requests
  WHERE id = p_ride_id
    AND customer_id = v_customer_id
    AND status = 'completed';

  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ride not completed or not yours';
  END IF;

  SELECT id INTO v_existing
  FROM public.ratings
  WHERE ride_request_id = p_ride_id
    AND rater_type = 'customer'
    AND rater_id = v_customer_id;

  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'already rated';
  END IF;

  INSERT INTO public.ratings (
    ride_request_id, rater_type, rater_id, ratee_type, ratee_id, stars, comment
  ) VALUES (
    p_ride_id, 'customer', v_customer_id, 'driver', v_driver_id, p_stars, NULLIF(trim(p_comment), '')
  )
  RETURNING id INTO v_rating_id;

  RETURN v_rating_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_rating(uuid, int, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.submit_rating(uuid, int, text) TO authenticated;;
