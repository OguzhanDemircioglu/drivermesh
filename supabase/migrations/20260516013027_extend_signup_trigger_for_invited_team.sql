-- M11: davet redeem akışındaki driver/manager kayıtları da profile alsın
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
  v_org_id_meta uuid;
  v_org_id uuid;
  v_default_status user_availability_status;
BEGIN
  v_role := NEW.raw_user_meta_data->>'role';
  IF v_role IS NULL OR v_role NOT IN ('owner','driver','manager') THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;
  v_full_name := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), split_part(NEW.email, '@', 1));
  -- Owner default 'active', davet edilen driver/manager 'off_duty' (spec)
  v_default_status := CASE WHEN v_role = 'owner' THEN 'active' ELSE 'off_duty' END::user_availability_status;

  IF v_role = 'owner' THEN
    v_company := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'company_name'), ''), 'Yeni Filo');
    INSERT INTO public.organizations (name, owner_id, feedback_email_enabled, feedback_push_enabled, feedback_telegram_enabled)
    VALUES (v_company, NEW.id, false, false, false)
    RETURNING id INTO v_org_id;
    INSERT INTO public.fleets_visibility (organization_id, ride_enabled) VALUES (v_org_id, false)
    ON CONFLICT (organization_id) DO NOTHING;
  ELSE
    -- Davet redeem akışından organization_id metadata gelir; yoksa NULL kalır,
    -- redeem_invitation_complete sonra UPDATE eder.
    v_org_id_meta := NULLIF(NEW.raw_user_meta_data->>'organization_id','')::uuid;
    v_org_id := v_org_id_meta;
  END IF;

  INSERT INTO public.profiles (id, organization_id, full_name, role, email, status, status_updated_at)
  VALUES (NEW.id, v_org_id, v_full_name, v_role::user_role, NEW.email, v_default_status, now());

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'create_fleet_owner_on_signup failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;;
