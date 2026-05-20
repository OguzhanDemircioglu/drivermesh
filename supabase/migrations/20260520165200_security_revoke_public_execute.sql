-- Önceki migration (20260520164900) anon'dan REVOKE etti ama PUBLIC default
-- EXECUTE yetkisi kaldı → anon PUBLIC üzerinden dolaylı çağırabiliyordu.
-- Bu migration PUBLIC'ten REVOKE ediyor. authenticated grant zaten yerinde,
-- service_role + postgres da elinde — production davranışı bozulmaz.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.claim_vehicle_for_ride(p_vehicle_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.complete_ride(p_ride_id uuid, p_fare_final numeric, p_distance_km numeric, p_duration_min integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.start_ride(p_ride_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.driver_arrived(p_ride_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_my_status(p_status user_availability_status) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_driver_rating(p_ride_id uuid, p_stars integer, p_comment text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.request_customer_account_deletion() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_deleted_accounts() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_session_last_message() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_vehicle_default_owner() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_view_profile(p_target_id uuid) FROM PUBLIC;

COMMIT;
