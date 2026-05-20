-- driver_arrived: Şoför pickup noktasına vardı.
-- Sadece şoför (ride.driver_id = auth.uid()) ve status='assigned' olduğunda.
CREATE OR REPLACE FUNCTION public.driver_arrived(p_ride_id uuid)
RETURNS ride_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_driver uuid;
  v_status ride_status;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='T4: auth required';
  END IF;
  SELECT driver_id, status INTO v_driver, v_status
  FROM public.ride_requests
  WHERE id = p_ride_id
  FOR UPDATE;
  IF v_driver IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='ride not found';
  END IF;
  IF v_driver <> v_uid THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='not your ride';
  END IF;
  IF v_status <> 'assigned' THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='invalid transition: assigned->driver_arrived';
  END IF;
  UPDATE public.ride_requests
  SET status='driver_arrived', arrived_at=now()
  WHERE id=p_ride_id;
  RETURN 'driver_arrived';
END;
$$;

-- start_ride: Şoför yolculuğu başlattı.
CREATE OR REPLACE FUNCTION public.start_ride(p_ride_id uuid)
RETURNS ride_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_driver uuid;
  v_status ride_status;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='T4: auth required';
  END IF;
  SELECT driver_id, status INTO v_driver, v_status
  FROM public.ride_requests
  WHERE id = p_ride_id
  FOR UPDATE;
  IF v_driver IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='ride not found';
  END IF;
  IF v_driver <> v_uid THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='not your ride';
  END IF;
  IF v_status <> 'driver_arrived' THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='invalid transition: driver_arrived->in_progress';
  END IF;
  UPDATE public.ride_requests
  SET status='in_progress', started_at=now()
  WHERE id=p_ride_id;
  RETURN 'in_progress';
END;
$$;

-- complete_ride: Şoför yolculuğu tamamladı.
CREATE OR REPLACE FUNCTION public.complete_ride(
  p_ride_id uuid,
  p_fare_final numeric DEFAULT NULL,
  p_distance_km numeric DEFAULT NULL,
  p_duration_min integer DEFAULT NULL
)
RETURNS ride_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_driver uuid;
  v_status ride_status;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='T4: auth required';
  END IF;
  SELECT driver_id, status INTO v_driver, v_status
  FROM public.ride_requests
  WHERE id = p_ride_id
  FOR UPDATE;
  IF v_driver IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='ride not found';
  END IF;
  IF v_driver <> v_uid THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='not your ride';
  END IF;
  IF v_status <> 'in_progress' THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='invalid transition: in_progress->completed';
  END IF;
  UPDATE public.ride_requests
  SET status='completed',
      completed_at=now(),
      fare_final=COALESCE(p_fare_final, fare_final),
      distance_km=COALESCE(p_distance_km, distance_km),
      duration_min=COALESCE(p_duration_min, duration_min)
  WHERE id=p_ride_id;
  RETURN 'completed';
END;
$$;

GRANT EXECUTE ON FUNCTION public.driver_arrived(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_ride(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_ride(uuid, numeric, numeric, integer) TO authenticated;;
