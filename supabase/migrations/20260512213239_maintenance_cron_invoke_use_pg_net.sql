
CREATE OR REPLACE FUNCTION public.maintenance_cron_invoke()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, vault, pg_temp
AS $$
DECLARE
  _secret TEXT;
  _request_id BIGINT;
BEGIN
  SELECT decrypted_secret INTO _secret
    FROM vault.decrypted_secrets
   WHERE name = 'cron_secret'
   LIMIT 1;

  IF _secret IS NULL THEN
    RETURN 'cron_secret missing in vault';
  END IF;

  SELECT net.http_post(
    url := 'https://ucitxvsndlwvvnqwabgo.supabase.co/functions/v1/maintenance-cron?s=' || _secret,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json')
  ) INTO _request_id;

  RETURN 'fired:' || _request_id::text;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.maintenance_cron_invoke() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.maintenance_cron_invoke() TO postgres;;
