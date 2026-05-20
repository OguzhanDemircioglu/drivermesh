-- Security hardening dalgası:
-- 1) `function_search_path_mutable` 2 fonksiyon → search_path kilidi
-- 2) `anon_security_definer_function_executable` 11 RPC → anon REVOKE
--    (sign-up trigger'ları + is_fleet_open + redeem_invitation_lookup gibi
--     gerçekten anon erişim gerektirenlere DOKUNULMAZ)
--
-- NOT: `spatial_ref_sys` advisor `rls_disabled_in_public` ERROR'unu da
-- veriyor ama PostGIS extension'ının sahip olduğu sistem tablosu —
-- Supabase'de postgres role owner değil, ALTER TABLE permission denied.
-- Bilinen istisna; risk yok (extension internal lookup tablosu).

BEGIN;

-- 1) Function search_path kilidi
ALTER FUNCTION public.kb_chunks_set_updated_at()
  SET search_path = public, pg_catalog;
ALTER FUNCTION public.prevent_vehicle_reassign_during_active_ride()
  SET search_path = public, pg_catalog;

-- 2) anon EXECUTE revoke — UI'den authenticated user gerektiren RPC'ler
REVOKE EXECUTE ON FUNCTION public.claim_vehicle_for_ride(p_vehicle_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.complete_ride(p_ride_id uuid, p_fare_final numeric, p_distance_km numeric, p_duration_min integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.start_ride(p_ride_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.driver_arrived(p_ride_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_my_status(p_status user_availability_status) FROM anon;
REVOKE EXECUTE ON FUNCTION public.submit_driver_rating(p_ride_id uuid, p_stars integer, p_comment text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.request_customer_account_deletion() FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_deleted_accounts() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_session_last_message() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_vehicle_default_owner() FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_view_profile(p_target_id uuid) FROM anon;

COMMIT;
