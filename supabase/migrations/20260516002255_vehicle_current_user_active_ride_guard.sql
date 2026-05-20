-- BEFORE UPDATE trigger: vehicle aktif ride'da iken current_user_id direct UPDATE'ini bloklar.
-- claim_vehicle_for_ride RPC zaten T8 veriyor; bu defansif katman service-role direct UPDATE'i de yakalar.
-- ride state geçişleri (assigned → driver_arrived vs.) driver_id'yi değiştirmez, sadece current_user_id korunur.
CREATE OR REPLACE FUNCTION public.prevent_vehicle_reassign_during_active_ride()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.current_user_id IS DISTINCT FROM OLD.current_user_id THEN
    IF EXISTS (
      SELECT 1 FROM public.ride_requests
      WHERE vehicle_id = NEW.id
        AND status IN ('searching','assigned','driver_arrived','in_progress')
    ) THEN
      RAISE EXCEPTION USING ERRCODE='P0001',
        MESSAGE='T8: vehicle on active ride (direct reassign blocked)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER vehicles_block_reassign_during_active
BEFORE UPDATE ON public.vehicles
FOR EACH ROW
WHEN (OLD.current_user_id IS DISTINCT FROM NEW.current_user_id)
EXECUTE FUNCTION public.prevent_vehicle_reassign_during_active_ride();;
