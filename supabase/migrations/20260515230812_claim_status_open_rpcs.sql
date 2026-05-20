-- is_fleet_open: fleet'in operating_hours JSON'una göre o anda açık mı kontrolü
-- Format: {"tz":"Europe/Istanbul","mon":[{"start":"HH:MM","end":"HH:MM"}],...,"sun":[]}
-- NULL operating_hours → 7/24 açık (geriye uyumluluk)
CREATE OR REPLACE FUNCTION public.is_fleet_open(p_org_id uuid, p_at timestamptz DEFAULT now())
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_hours jsonb;
  v_tz text;
  v_local timestamp;
  v_day text;
  v_ranges jsonb;
  v_range jsonb;
  v_start text;
  v_end text;
BEGIN
  SELECT operating_hours INTO v_hours
  FROM public.fleets_visibility
  WHERE organization_id = p_org_id;

  IF v_hours IS NULL THEN
    RETURN true;
  END IF;

  v_tz := COALESCE(v_hours->>'tz', 'Europe/Istanbul');
  v_local := (p_at AT TIME ZONE v_tz);
  v_day := lower(to_char(v_local, 'dy'));
  v_ranges := v_hours->v_day;

  IF v_ranges IS NULL OR jsonb_typeof(v_ranges) <> 'array' OR jsonb_array_length(v_ranges) = 0 THEN
    RETURN false;
  END IF;

  FOR v_range IN SELECT jsonb_array_elements(v_ranges) LOOP
    v_start := v_range->>'start';
    v_end := v_range->>'end';
    IF v_start IS NULL OR v_end IS NULL THEN CONTINUE; END IF;
    IF (v_local::time) >= (v_start::time) AND (v_local::time) < (v_end::time) THEN
      RETURN true;
    END IF;
  END LOOP;

  RETURN false;
END;
$$;

-- set_my_status: kullanıcı kendi profile.status'unu değiştirir.
-- on_trip manuel set yasak (T10). active ride sırasında manuel başka status yasak.
CREATE OR REPLACE FUNCTION public.set_my_status(p_status user_availability_status)
RETURNS user_availability_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_current user_availability_status;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='T4: auth required';
  END IF;
  IF p_status = 'on_trip' THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='T10: on_trip cannot be set manually';
  END IF;

  SELECT status INTO v_current FROM public.profiles WHERE id = v_uid;
  IF v_current IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='T4: profile missing';
  END IF;
  IF v_current = 'on_trip' THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='T10: cannot override on_trip while in active ride';
  END IF;

  UPDATE public.profiles
  SET status = p_status, status_updated_at = now()
  WHERE id = v_uid;

  RETURN p_status;
END;
$$;

-- claim_vehicle: caller, aynı org içindeki bir aracı kendi üstüne alır.
-- Lock: aktif ride (T8), maintenance (T9), org mismatch (T3).
CREATE OR REPLACE FUNCTION public.claim_vehicle(p_vehicle_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_user_org uuid;
  v_vehicle_org uuid;
  v_current uuid;
  v_maint timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='T4: auth required';
  END IF;
  SELECT organization_id INTO v_user_org FROM public.profiles WHERE id = v_uid;
  IF v_user_org IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='T4: profile missing';
  END IF;

  SELECT organization_id, current_user_id, maintenance_started_at
    INTO v_vehicle_org, v_current, v_maint
  FROM public.vehicles
  WHERE id = p_vehicle_id
  FOR UPDATE;

  IF v_vehicle_org IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='vehicle not found';
  END IF;
  IF v_vehicle_org <> v_user_org THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='T3: vehicle belongs to another org';
  END IF;
  IF v_maint IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='T9: vehicle in maintenance';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.ride_requests
    WHERE vehicle_id = p_vehicle_id
      AND status IN ('searching','assigned','driver_arrived','in_progress')
  ) THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='T8: vehicle on active ride';
  END IF;

  -- Idempotent: zaten benim ise no-op
  IF v_current = v_uid THEN
    RETURN p_vehicle_id;
  END IF;

  UPDATE public.vehicles
  SET current_user_id = v_uid
  WHERE id = p_vehicle_id;

  RETURN p_vehicle_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_fleet_open(uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_status(user_availability_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_vehicle(uuid) TO authenticated;;
