-- Vault'a secret yazan SECURITY DEFINER helper RPC.
-- Sadece service_role bunu cagirabilir (PostgREST RLS ile guvenli).
-- Idempotent: ayni isimle varsa value'yu update eder.
CREATE OR REPLACE FUNCTION public.set_vault_secret(p_name TEXT, p_value TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
  _existing_id UUID;
  _new_id UUID;
BEGIN
  SELECT id INTO _existing_id FROM vault.secrets WHERE name = p_name LIMIT 1;
  IF _existing_id IS NOT NULL THEN
    PERFORM vault.update_secret(_existing_id, p_value, p_name);
    RETURN _existing_id;
  END IF;
  SELECT vault.create_secret(p_value, p_name) INTO _new_id;
  RETURN _new_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_vault_secret(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_vault_secret(TEXT, TEXT) TO service_role;

-- ============================================================================
-- Cron auto-checkout RPC: anon_key yerine service_role_key kullanacak sekilde
-- guncelle. send-push v4 service_role bearer ile cagrilirsa org-match auth
-- check'i skip eder (cron internal trigger).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.maintenance_auto_checkout()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault, pg_temp
AS $$
DECLARE
  _service_key TEXT;
  _project_url TEXT := 'https://ucitxvsndlwvvnqwabgo.supabase.co';
  _vehicle RECORD;
  _manager RECORD;
  _affected INT := 0;
  _photo_url TEXT;
  _public_id TEXT;
BEGIN
  -- Service role key (vault'tan, send-push v4 icin)
  SELECT decrypted_secret INTO _service_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;

  -- Overdue arac doneyi
  FOR _vehicle IN
    SELECT v.id, v.organization_id, v.plate, v.maintenance_photo_urls, v.maintenance_reason
    FROM vehicles v
    WHERE v.status = 'maintenance'
      AND v.maintenance_until IS NOT NULL
      AND v.maintenance_until < NOW()
  LOOP
    -- Arac reset
    UPDATE vehicles
    SET status = 'idle',
        maintenance_until = NULL,
        maintenance_started_at = NULL,
        maintenance_started_by = NULL,
        maintenance_reason = NULL,
        maintenance_photo_urls = '{}'::text[]
    WHERE id = _vehicle.id;

    -- Foto cleanup (Cloudinary destroy)
    IF _service_key IS NOT NULL AND _vehicle.maintenance_photo_urls IS NOT NULL THEN
      FOREACH _photo_url IN ARRAY _vehicle.maintenance_photo_urls LOOP
        _public_id := public.cloudinary_public_id_from_url(_photo_url);
        IF _public_id IS NOT NULL THEN
          PERFORM extensions.http_post(
            url := _project_url || '/functions/v1/cloudinary-destroy',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || _service_key
            ),
            body := jsonb_build_object('public_id', _public_id)::text
          );
        END IF;
      END LOOP;
    END IF;

    -- Yoneticilere maintenance_overdue notification + push
    IF _service_key IS NOT NULL THEN
      FOR _manager IN
        SELECT id FROM profiles
        WHERE organization_id = _vehicle.organization_id
          AND role IN ('owner', 'manager')
      LOOP
        -- Push gonder (send-push insert+push tek atimda yapacak — v3 persist:true default)
        PERFORM extensions.http_post(
          url := _project_url || '/functions/v1/send-push',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || _service_key
          ),
          body := jsonb_build_object(
            'recipient_id', _manager.id,
            'type', 'maintenance_overdue',
            'title', 'Bakım Tamamlandı (Otomatik)',
            'body', _vehicle.plate || ' artık aktif',
            'data', jsonb_build_object(
              'plate', _vehicle.plate,
              'vehicleId', _vehicle.id,
              'auto', true
            )
          )::text
        );
      END LOOP;
    END IF;

    _affected := _affected + 1;
  END LOOP;

  RETURN _affected;
END;
$$;

GRANT EXECUTE ON FUNCTION public.maintenance_auto_checkout() TO service_role;;
