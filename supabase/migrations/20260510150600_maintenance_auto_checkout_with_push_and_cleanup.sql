
-- Cloudinary URL'sinden public_id cikarir.
-- Ornek: https://res.cloudinary.com/dotcw6tty/image/upload/v123/drivermesh/x/y.png
--   -> drivermesh/x/y
CREATE OR REPLACE FUNCTION public.cloudinary_public_id_from_url(url TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  m TEXT[];
BEGIN
  IF url IS NULL THEN RETURN NULL; END IF;
  m := regexp_match(url, '/upload/(?:v\d+/)?(.+?)(?:\.[^./]+)?$');
  IF m IS NULL THEN RETURN NULL; END IF;
  RETURN m[1];
END;
$$;

-- Auto-checkout RPC: cron her dakika cagirir.
-- (1) maintenance_until dolan araclari idle'a doner + state kolonlarini temizler
-- (2) overdue notification'i yoneticilere insert eder (in-app)
-- (3) FCM push gonderir send-push edge function'a (anon_key vault'tan)
-- (4) Vehicle'in maintenance_photo_urls'ini Cloudinary'den destroy eder
--
-- vault.decrypted_secrets WHERE name='anon_key' yoksa (3) ve (4) atlanir
-- (in-app notification'lar yine yazilir).
CREATE OR REPLACE FUNCTION public.maintenance_auto_checkout()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v RECORD;
  m RECORD;
  affected INTEGER := 0;
  anon_key TEXT;
  base_url TEXT := 'https://ucitxvsndlwvvnqwabgo.supabase.co/functions/v1';
  photo_url TEXT;
  pub_id TEXT;
BEGIN
  -- Vault secret — yoksa NULL olur, push/cleanup atlanir.
  SELECT decrypted_secret INTO anon_key
    FROM vault.decrypted_secrets WHERE name = 'anon_key' LIMIT 1;

  FOR v IN
    SELECT id, organization_id, plate, maintenance_photo_urls
    FROM public.vehicles
    WHERE status = 'maintenance'
      AND maintenance_until IS NOT NULL
      AND maintenance_until < NOW()
  LOOP
    -- (1) Vehicle reset
    UPDATE public.vehicles
    SET
      status = 'idle',
      maintenance_until = NULL,
      maintenance_started_at = NULL,
      maintenance_started_by = NULL,
      maintenance_reason = NULL,
      maintenance_photo_urls = '{}'
    WHERE id = v.id;

    -- (2) In-app notification: yoneticilere overdue
    --     + (3) push (anon_key varsa)
    FOR m IN
      SELECT id FROM public.profiles
      WHERE organization_id = v.organization_id
        AND role IN ('owner', 'manager')
    LOOP
      INSERT INTO public.notifications (organization_id, recipient_id, actor_id, type, payload)
      VALUES (
        v.organization_id, m.id, NULL, 'maintenance_overdue',
        jsonb_build_object('vehicleId', v.id, 'plate', v.plate, 'auto', true)
      );

      IF anon_key IS NOT NULL THEN
        PERFORM extensions.http_post(
          url := base_url || '/send-push',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || anon_key
          ),
          body := jsonb_build_object(
            'recipient_id', m.id,
            'type', 'maintenance_overdue',
            'title', v.plate || ' bakim suresi doldu',
            'data', jsonb_build_object('vehicleId', v.id, 'plate', v.plate, 'auto', true)
          )
        );
      END IF;
    END LOOP;

    -- (4) Cloudinary cleanup
    IF anon_key IS NOT NULL AND v.maintenance_photo_urls IS NOT NULL THEN
      FOREACH photo_url IN ARRAY v.maintenance_photo_urls LOOP
        pub_id := public.cloudinary_public_id_from_url(photo_url);
        IF pub_id IS NOT NULL AND pub_id LIKE 'drivermesh/%' THEN
          PERFORM extensions.http_post(
            url := base_url || '/cloudinary-destroy',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || anon_key
            ),
            body := jsonb_build_object('public_id', pub_id)
          );
        END IF;
      END LOOP;
    END IF;

    affected := affected + 1;
  END LOOP;
  RETURN affected;
END;
$$;

COMMENT ON FUNCTION public.maintenance_auto_checkout() IS
  'pg_cron her dakika cagirir. maintenance_until gecmis araclari idle yapar; overdue bildirimi (in-app + FCM push) ve Cloudinary foto temizligi tetikler. anon_key vault''ta yoksa push/temizlik sessizce atlanir.';;
