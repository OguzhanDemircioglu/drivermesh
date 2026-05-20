
CREATE OR REPLACE FUNCTION public.get_vault_secret(p_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret TEXT;
BEGIN
  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
    WHERE name = p_name LIMIT 1;
  RETURN v_secret;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_vault_secret(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_vault_secret(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_vault_secret(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_vault_secret(TEXT) TO service_role;

COMMENT ON FUNCTION public.get_vault_secret(TEXT) IS
  'Edge Function service_role caller vault okumasi icin helper. Anon kapali.';;
