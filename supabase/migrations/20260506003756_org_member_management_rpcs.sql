-- Owner-only RPC: change a member's role between manager and driver
CREATE OR REPLACE FUNCTION public.change_member_role(
  p_member_id uuid,
  p_new_role public.user_role
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_role public.user_role;
  v_actor_org uuid;
  v_target_role public.user_role;
  v_target_org uuid;
BEGIN
  IF p_new_role = 'owner' THEN
    RAISE EXCEPTION 'cannot_promote_to_owner';
  END IF;

  SELECT role, organization_id INTO v_actor_role, v_actor_org
  FROM public.profiles WHERE id = auth.uid();

  IF v_actor_role IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT role, organization_id INTO v_target_role, v_target_org
  FROM public.profiles WHERE id = p_member_id;

  IF v_target_org IS NULL OR v_target_org IS DISTINCT FROM v_actor_org THEN
    RAISE EXCEPTION 'cross_org_forbidden';
  END IF;

  IF v_target_role = 'owner' THEN
    RAISE EXCEPTION 'cannot_edit_owner_permissions';
  END IF;

  IF p_member_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot_edit_own_permissions';
  END IF;

  UPDATE public.profiles SET role = p_new_role WHERE id = p_member_id;
END;
$$;

-- Owner-only RPC: remove a member from the organization
CREATE OR REPLACE FUNCTION public.remove_org_member(p_member_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_role public.user_role;
  v_actor_org uuid;
  v_target_role public.user_role;
  v_target_org uuid;
BEGIN
  SELECT role, organization_id INTO v_actor_role, v_actor_org
  FROM public.profiles WHERE id = auth.uid();

  IF v_actor_role IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT role, organization_id INTO v_target_role, v_target_org
  FROM public.profiles WHERE id = p_member_id;

  IF v_target_org IS NULL OR v_target_org IS DISTINCT FROM v_actor_org THEN
    RAISE EXCEPTION 'cross_org_forbidden';
  END IF;

  IF v_target_role = 'owner' THEN
    RAISE EXCEPTION 'cannot_remove_owner';
  END IF;

  IF p_member_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot_remove_self';
  END IF;

  -- Unassign open/assigned/in_progress jobs the member is on, but keep history
  UPDATE public.jobs
     SET driver_id = NULL,
         assigned_at = NULL,
         status = CASE WHEN status IN ('assigned','in_progress') THEN 'open'::public.job_status ELSE status END
   WHERE driver_id = p_member_id
     AND status IN ('assigned','in_progress');

  -- Delete any permission overrides for this user
  DELETE FROM public.permission_overrides WHERE user_id = p_member_id;

  -- Detach from org
  UPDATE public.profiles
     SET organization_id = NULL,
         role = 'driver'
   WHERE id = p_member_id;
END;
$$;;
