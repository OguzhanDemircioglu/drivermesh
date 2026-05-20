-- Yeni araç eklenirken current_user_id boş ise org owner'a atar.
CREATE OR REPLACE FUNCTION public.set_vehicle_default_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_owner uuid;
BEGIN
  IF NEW.current_user_id IS NULL THEN
    SELECT owner_id INTO v_owner
    FROM public.organizations
    WHERE id = NEW.organization_id;
    NEW.current_user_id := COALESCE(v_owner, NEW.added_by);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER vehicles_set_default_owner
BEFORE INSERT ON public.vehicles
FOR EACH ROW EXECUTE FUNCTION public.set_vehicle_default_owner();;
