-- v3: cron secret artik query param ?s=... yerine Authorization Bearer
-- header ile gonderilir. Edge fn (maintenance-cron v3) deploy edildi,
-- bu RPC'yi de header pattern'ine geciriyoruz. URL'den secret kaldirildi
-- (Cloudflare/Supabase log'unda full URL leak'i kapandi).
CREATE OR REPLACE FUNCTION public.maintenance_cron_invoke()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'net', 'vault', 'pg_temp'
AS $function$
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
    url := 'https://ucitxvsndlwvvnqwabgo.supabase.co/functions/v1/maintenance-cron',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _secret
    )
  ) INTO _request_id;

  RETURN 'fired:' || _request_id::text;
END;
$function$;;
