
-- 1) RPC: bakim suresi dolmus araclar icin otomatik checkout
CREATE OR REPLACE FUNCTION public.maintenance_auto_checkout()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v RECORD;
  affected INTEGER := 0;
BEGIN
  FOR v IN
    SELECT id, organization_id, plate
    FROM public.vehicles
    WHERE status = 'maintenance'
      AND maintenance_until IS NOT NULL
      AND maintenance_until < NOW()
  LOOP
    -- vehicle reset
    UPDATE public.vehicles
    SET
      status = 'idle',
      maintenance_until = NULL,
      maintenance_started_at = NULL,
      maintenance_started_by = NULL,
      maintenance_reason = NULL,
      maintenance_photo_urls = '{}'
    WHERE id = v.id;

    -- yoneticilere overdue bildirimi
    INSERT INTO public.notifications (organization_id, recipient_id, actor_id, type, payload)
    SELECT
      v.organization_id,
      p.id,
      NULL,
      'maintenance_overdue',
      jsonb_build_object('vehicleId', v.id, 'plate', v.plate, 'auto', true)
    FROM public.profiles p
    WHERE p.organization_id = v.organization_id
      AND p.role IN ('owner', 'manager');

    affected := affected + 1;
  END LOOP;
  RETURN affected;
END;
$$;

COMMENT ON FUNCTION public.maintenance_auto_checkout() IS
  'Bakim_until suresi dolmus araclari otomatik idle yapip yoneticilere maintenance_overdue bildirimi atar. pg_cron her dakika cagirir.';

-- 2) pg_cron her dakika
SELECT cron.schedule(
  'maintenance-auto-checkout',
  '* * * * *',
  $cron$SELECT public.maintenance_auto_checkout();$cron$
);;
