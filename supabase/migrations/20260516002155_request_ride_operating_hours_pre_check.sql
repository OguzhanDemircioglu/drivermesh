-- T11: request_ride RPC mesai dışı çağrıyı reddeder
CREATE OR REPLACE FUNCTION public.request_ride(p_vehicle_id uuid, p_pickup_lng double precision, p_pickup_lat double precision, p_pickup_address text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_customer_id uuid;
  v_blocked boolean;
  v_driver_id uuid;
  v_org_id uuid;
  v_ride_id uuid;
BEGIN
  SELECT id, blocked INTO v_customer_id, v_blocked
  FROM public.customers WHERE auth_user_id = auth.uid();
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

  -- T11 yeni: driver mevcut rolü ve aktif statusü doğrula (search v2 filtreleriyle eş)
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_driver_id AND p.role = 'driver' AND p.status = 'active'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'T11: driver unavailable (role/status)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.fleets_visibility
    WHERE organization_id = v_org_id AND ride_enabled = true
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'T6: fleet ride disabled';
  END IF;

  -- T12 yeni: mesai saatleri içinde mi
  IF NOT public.is_fleet_open(v_org_id) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'T12: fleet closed (operating hours)';
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
$function$;;
