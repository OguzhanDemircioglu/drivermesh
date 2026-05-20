-- Fleet signup (email+password) sonrası otomatik organization + profile yaratır.
-- Phone signup'lar (customer) için on_auth_user_created_customer trigger'ı zaten var,
-- bu sadece email + raw_user_meta_data.role='owner' olanlar için çalışır.
CREATE OR REPLACE FUNCTION public.create_fleet_owner_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  v_company text;
  v_full_name text;
  v_role text;
  v_org_id uuid;
BEGIN
  v_role := NEW.raw_user_meta_data->>'role';
  -- Sadece fleet owner signup için (role='owner'). Phone signup'larda raw_user_meta_data.role yok.
  IF v_role IS DISTINCT FROM 'owner' THEN
    RETURN NEW;
  END IF;
  -- Profile zaten varsa (race veya manuel insert) atla.
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;
  v_company := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'company_name'), ''), 'Yeni Filo');
  v_full_name := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), split_part(NEW.email, '@', 1));

  INSERT INTO public.organizations
    (name, owner_id, feedback_email_enabled, feedback_push_enabled, feedback_telegram_enabled)
  VALUES (v_company, NEW.id, false, false, false)
  RETURNING id INTO v_org_id;

  INSERT INTO public.profiles
    (id, organization_id, full_name, role, email, status, status_updated_at)
  VALUES (NEW.id, v_org_id, v_full_name, 'owner', NEW.email, 'active', now());

  -- Default fleet visibility: ride disabled, owner UI'dan açacak (V2)
  INSERT INTO public.fleets_visibility (organization_id, ride_enabled)
  VALUES (v_org_id, false)
  ON CONFLICT (organization_id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Best-effort: bir sebepten fail olursa auth.users insert'i bloklamayalım.
  RAISE WARNING 'create_fleet_owner_on_signup failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_fleet_owner_signup
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.create_fleet_owner_on_signup();;
