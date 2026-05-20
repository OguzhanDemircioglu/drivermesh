-- Trigger güncellemesi: davetli (manager/driver) için organization_id'yi metadata'dan al
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  meta jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_role public.user_role := COALESCE((meta->>'role')::public.user_role, 'owner');
  v_full_name text := COALESCE(meta->>'full_name', split_part(NEW.email, '@', 1));
  v_company_name text := COALESCE(meta->>'company_name', v_full_name || ' Filo');
  v_org_id uuid;
BEGIN
  IF v_role = 'owner' THEN
    INSERT INTO public.organizations (name, owner_id)
    VALUES (v_company_name, NEW.id)
    RETURNING id INTO v_org_id;
  ELSE
    -- davetli akış: organization_id metadata'dan
    v_org_id := NULLIF(meta->>'organization_id', '')::uuid;
  END IF;

  INSERT INTO public.profiles (id, organization_id, full_name, role, email)
  VALUES (NEW.id, v_org_id, v_full_name, v_role, NEW.email);

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ============ Davet kabul: lookup (anon) ============
CREATE OR REPLACE FUNCTION public.redeem_invitation_lookup(p_short_code text)
RETURNS TABLE (
  invitation_id uuid,
  organization_id uuid,
  organization_name text,
  full_name text,
  email text,
  role public.user_role
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.id,
    i.organization_id,
    o.name,
    i.full_name,
    i.email,
    i.role
  FROM public.invitations i
  JOIN public.organizations o ON o.id = i.organization_id
  WHERE upper(substring(i.token FROM 1 FOR 6)) = upper(trim(p_short_code))
    AND i.status = 'pending'
    AND i.expires_at > now()
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.redeem_invitation_lookup(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_invitation_lookup(text) TO anon, authenticated;

-- ============ Davet kabul: complete (authenticated only) ============
CREATE OR REPLACE FUNCTION public.redeem_invitation_complete(p_short_code text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_inv_id uuid;
  v_inv_org uuid;
  v_user_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();

  SELECT id, organization_id INTO v_inv_id, v_inv_org
  FROM public.invitations
  WHERE upper(substring(token FROM 1 FOR 6)) = upper(trim(p_short_code))
    AND status = 'pending'
    AND expires_at > now()
    AND lower(email) = lower(v_user_email)
  LIMIT 1;

  IF v_inv_id IS NULL THEN
    RAISE EXCEPTION 'invitation not found or invalid for this email';
  END IF;

  UPDATE public.invitations
  SET status = 'accepted', accepted_at = now(), accepted_by = auth.uid()
  WHERE id = v_inv_id;

  UPDATE public.profiles
  SET organization_id = v_inv_org
  WHERE id = auth.uid() AND (organization_id IS NULL OR organization_id <> v_inv_org);

  RETURN v_inv_org;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.redeem_invitation_complete(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_invitation_complete(text) TO authenticated;;
