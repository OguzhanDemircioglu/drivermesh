-- Ride status değiştiğinde driver.status'u otomatik sync eder:
-- assigned/driver_arrived/in_progress → on_trip (pre_trip_status backup)
-- completed/cancelled_* → pre_trip_status'a döner (yoksa 'active')
CREATE OR REPLACE FUNCTION public.sync_driver_status_on_ride_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_active_states ride_status[] := ARRAY['searching','assigned','driver_arrived','in_progress']::ride_status[];
  v_terminal_states ride_status[] := ARRAY['completed','cancelled_by_customer','cancelled_by_driver','cancelled_by_system','no_drivers_available']::ride_status[];
  v_prev user_availability_status;
BEGIN
  IF NEW.driver_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Aktif state'lere geçiş (önceden aktif değilse pre_trip_status kaydet, on_trip set)
  IF (TG_OP = 'INSERT' AND NEW.status = ANY(v_active_states))
     OR (TG_OP = 'UPDATE' AND NEW.status = ANY(v_active_states) AND OLD.status <> NEW.status AND NOT (OLD.status = ANY(v_active_states)))
  THEN
    SELECT status INTO v_prev FROM public.profiles WHERE id = NEW.driver_id;
    IF v_prev IS DISTINCT FROM 'on_trip' THEN
      UPDATE public.profiles
      SET pre_trip_status = v_prev,
          status = 'on_trip',
          status_updated_at = now()
      WHERE id = NEW.driver_id;
    END IF;
  END IF;

  -- Terminal state geçişi (önceden aktif idiyse pre_trip_status'a dön)
  IF TG_OP = 'UPDATE'
     AND NEW.status = ANY(v_terminal_states)
     AND OLD.status = ANY(v_active_states)
  THEN
    UPDATE public.profiles
    SET status = COALESCE(pre_trip_status, 'active'),
        pre_trip_status = NULL,
        status_updated_at = now()
    WHERE id = NEW.driver_id
      AND status = 'on_trip';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER ride_requests_driver_status_sync
AFTER INSERT OR UPDATE ON public.ride_requests
FOR EACH ROW EXECUTE FUNCTION public.sync_driver_status_on_ride_change();;
