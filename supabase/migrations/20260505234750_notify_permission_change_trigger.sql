CREATE OR REPLACE FUNCTION public.notify_permission_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_label_tr text;
  v_label_en text;
  v_is_critical boolean;
BEGIN
  SELECT label_tr, label_en, is_critical
    INTO v_label_tr, v_label_en, v_is_critical
  FROM public.permission_keys
  WHERE key = NEW.key;

  -- Avoid self-notification (shouldn't normally happen)
  IF NEW.granted_by = NEW.user_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (organization_id, recipient_id, actor_id, type, payload)
  VALUES (
    NEW.organization_id,
    NEW.user_id,
    NEW.granted_by,
    CASE WHEN NEW.allowed THEN 'permission_granted' ELSE 'permission_revoked' END,
    jsonb_build_object(
      'key', NEW.key,
      'label_tr', v_label_tr,
      'label_en', v_label_en,
      'is_critical', COALESCE(v_is_critical, false),
      'allowed', NEW.allowed
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_permission_change ON public.permission_overrides;

CREATE TRIGGER trg_notify_permission_change
AFTER INSERT OR UPDATE ON public.permission_overrides
FOR EACH ROW EXECUTE FUNCTION public.notify_permission_change();;
