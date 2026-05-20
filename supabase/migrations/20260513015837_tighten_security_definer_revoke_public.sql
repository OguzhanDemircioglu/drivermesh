-- Onceki tighten_security_definer_anon_revoke no-op'tu cunku anon
-- PUBLIC role'unun uyesi, PUBLIC EXECUTE grant'i default. Bu sefer
-- PUBLIC'ten revoke + authenticated'a explicit grant — anon kayip,
-- authenticated korunur. Idempotent (REVOKE/GRANT zaten var olani
-- override etmez, hata vermez).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'change_member_role','claim_vehicle','clear_at_hq_on_dispatch',
        'notify_driver_request','notify_driver_request_resolution',
        'notify_permission_change','release_vehicle','remove_org_member',
        'delete_fleet','transfer_ownership','maintenance_cron_invoke'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC',
                   r.nspname, r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated',
                   r.nspname, r.proname, r.args);
  END LOOP;
END;
$$;;
