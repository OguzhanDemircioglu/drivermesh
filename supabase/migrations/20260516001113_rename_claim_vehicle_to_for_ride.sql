-- Eski B2B claim_vehicle(uuid, text) korunur. Yeni ride-spesifik RPC ayrı ada taşınır.
DROP FUNCTION IF EXISTS public.claim_vehicle(p_vehicle_id uuid);

CREATE OR REPLACE FUNCTION public.claim_vehicle_for_ride(p_vehicle_id uuid)
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

  IF v_current = v_uid THEN
    RETURN p_vehicle_id;
  END IF;

  UPDATE public.vehicles SET current_user_id = v_uid WHERE id = p_vehicle_id;
  RETURN p_vehicle_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_vehicle_for_ride(uuid) TO authenticated;;
