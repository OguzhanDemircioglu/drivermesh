
-- 1) Random cron_secret üret + vault'a yaz (varsa güncelle, yoksa oluştur)
DO $$
DECLARE
  _secret TEXT := encode(gen_random_bytes(32), 'hex');
  _existing UUID;
BEGIN
  SELECT id INTO _existing FROM vault.secrets WHERE name = 'cron_secret' LIMIT 1;
  IF _existing IS NOT NULL THEN
    PERFORM vault.update_secret(_existing, _secret, 'cron_secret');
  ELSE
    PERFORM vault.create_secret(_secret, 'cron_secret');
  END IF;
END $$;

-- 2) RPC: pg_cron job'tan çağrılır, vault'tan secret okur, edge function'a http_post
CREATE OR REPLACE FUNCTION public.maintenance_cron_invoke()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault, pg_temp
AS $$
DECLARE
  _secret TEXT;
BEGIN
  SELECT decrypted_secret INTO _secret
    FROM vault.decrypted_secrets
   WHERE name = 'cron_secret'
   LIMIT 1;

  IF _secret IS NULL THEN
    RETURN 'cron_secret missing in vault';
  END IF;

  PERFORM extensions.http_post(
    url := 'https://ucitxvsndlwvvnqwabgo.supabase.co/functions/v1/maintenance-cron?s=' || _secret,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'
  );

  RETURN 'fired';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.maintenance_cron_invoke() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.maintenance_cron_invoke() TO postgres;

-- 3) Eski 'maintenance-auto-checkout' cron job sil + yeni schedule
DO $$
DECLARE
  _id BIGINT;
BEGIN
  SELECT jobid INTO _id FROM cron.job WHERE jobname = 'maintenance-auto-checkout' LIMIT 1;
  IF _id IS NOT NULL THEN
    PERFORM cron.unschedule(_id);
  END IF;
END $$;

SELECT cron.schedule(
  'maintenance-auto-checkout',
  '* * * * *',
  'SELECT public.maintenance_cron_invoke();'
);

-- 4) Eski RPC drop
DROP FUNCTION IF EXISTS public.maintenance_auto_checkout();;
