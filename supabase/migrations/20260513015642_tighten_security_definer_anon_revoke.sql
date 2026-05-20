-- Defense-in-depth: 11 SECURITY DEFINER fonksiyonun anon EXECUTE'unu
-- revoke ediyoruz. 4 tanesi (clear_at_hq_on_dispatch, maintenance_cron_invoke,
-- notify_driver_request, notify_permission_change) internal trigger/cron
-- pattern, auth.uid() check yok — kritik. 7 tanesi (change_member_role,
-- claim_vehicle, delete_fleet, notify_driver_request_resolution,
-- release_vehicle, remove_org_member, transfer_ownership) auth.uid() ile
-- icerideki kontrolu var ama PostgREST RPC endpoint'i 404'lemek defense.
--
-- preview_invitation + redeem_invitation_lookup anon'a acik kalir
-- (davet akisi hesap olmadan once cagrilir). authenticated EXECUTE
-- ayni kalir, sadece anon revoke. Authenticated 46 fonksiyon icin ayri
-- bir tightening (REVOKE FROM PUBLIC + GRANT TO authenticated explicit)
-- ileride yapilabilir, simdilik scope sadece anon.

REVOKE EXECUTE ON FUNCTION public.change_member_role(uuid, public.user_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_vehicle(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.clear_at_hq_on_dispatch() FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_fleet() FROM anon;
REVOKE EXECUTE ON FUNCTION public.maintenance_cron_invoke() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_driver_request() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_driver_request_resolution() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_permission_change() FROM anon;
REVOKE EXECUTE ON FUNCTION public.release_vehicle(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.remove_org_member(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.transfer_ownership(uuid) FROM anon;;
