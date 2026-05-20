-- handle_new_user: sadece trigger tarafından çağrılır, RPC olarak erişilmesin
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- current_user_org_id / current_user_role: anonymous'a kapalı, sadece authenticated
REVOKE EXECUTE ON FUNCTION public.current_user_org_id() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;;
