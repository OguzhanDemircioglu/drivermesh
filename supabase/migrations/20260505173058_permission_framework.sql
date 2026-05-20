-- ============================================================
-- Permission framework: catalog + role defaults + overrides
-- + notifications + has_permission/list_member_permissions/set_permission_override
-- ============================================================

CREATE TABLE IF NOT EXISTS public.permission_keys (
  key text PRIMARY KEY,
  category text NOT NULL,
  is_critical boolean NOT NULL DEFAULT false,
  label_tr text NOT NULL,
  label_en text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);

INSERT INTO public.permission_keys (key, category, is_critical, label_tr, label_en, sort_order) VALUES
  ('vehicles.create',     'vehicles', false, 'Araç ekleme',                'Add vehicles',         10),
  ('vehicles.update',     'vehicles', false, 'Araç düzenleme',             'Edit vehicles',        20),
  ('vehicles.delete',     'vehicles', true,  'Araç silme',                 'Delete vehicles',      30),
  ('jobs.create',         'jobs',     false, 'İş açma',                    'Create jobs',          40),
  ('jobs.assign',         'jobs',     false, 'İş atama',                   'Assign jobs',          50),
  ('jobs.cancel',         'jobs',     true,  'İş iptal',                   'Cancel jobs',          60),
  ('jobs.update_any',     'jobs',     false, 'Tüm işleri düzenleme',       'Edit any job',         70),
  ('members.invite',      'members',  false, 'Üye davet',                  'Invite members',       80),
  ('members.delete',      'members',  true,  'Üye silme',                  'Remove members',       90),
  ('ride_orders.view',    'reports',  false, 'Müşteri siparişleri',        'View ride orders',    100),
  ('reports.view',        'reports',  false, 'Raporları görme',            'View reports',        110),
  ('settings.manage',     'settings', false, 'Ayarları yönetme',           'Manage settings',     120),
  ('organization.update', 'settings', true,  'Organizasyon ayarları',      'Update organization', 130),
  ('billing.manage',      'settings', true,  'Faturalandırma',             'Manage billing',      140)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.role_default_permissions (
  role public.user_role NOT NULL,
  key text NOT NULL REFERENCES public.permission_keys(key) ON DELETE CASCADE,
  allowed boolean NOT NULL,
  PRIMARY KEY (role, key)
);

INSERT INTO public.role_default_permissions(role, key, allowed)
SELECT 'owner'::public.user_role, key, true FROM public.permission_keys
ON CONFLICT (role, key) DO NOTHING;

INSERT INTO public.role_default_permissions(role, key, allowed)
SELECT 'manager'::public.user_role, key,
  CASE WHEN key IN (
    'vehicles.delete','members.delete','jobs.cancel',
    'organization.update','billing.manage','settings.manage'
  ) THEN false ELSE true END
FROM public.permission_keys
ON CONFLICT (role, key) DO NOTHING;

INSERT INTO public.role_default_permissions(role, key, allowed)
SELECT 'driver'::public.user_role, key, false FROM public.permission_keys
ON CONFLICT (role, key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.permission_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  key text NOT NULL REFERENCES public.permission_keys(key) ON DELETE CASCADE,
  allowed boolean NOT NULL,
  granted_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)
);
CREATE INDEX IF NOT EXISTS idx_permission_overrides_user ON public.permission_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_permission_overrides_org  ON public.permission_overrides(organization_id);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_org       ON public.notifications(organization_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.has_permission(p_user_id uuid, p_key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_override boolean;
  v_role public.user_role;
  v_default boolean;
BEGIN
  SELECT allowed INTO v_override
  FROM public.permission_overrides
  WHERE user_id = p_user_id AND key = p_key;
  IF FOUND THEN RETURN v_override; END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = p_user_id;
  IF v_role IS NULL THEN RETURN false; END IF;

  SELECT allowed INTO v_default
  FROM public.role_default_permissions
  WHERE role = v_role AND key = p_key;
  RETURN COALESCE(v_default, false);
END;
$$;
REVOKE ALL ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_member_permissions(p_member_id uuid)
RETURNS TABLE (
  key text,
  category text,
  is_critical boolean,
  label_tr text,
  label_en text,
  sort_order int,
  default_allowed boolean,
  override_allowed boolean,
  effective_allowed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_member_org uuid;
  v_caller_role public.user_role;
  v_caller_org uuid;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'unauthorized' USING errcode = '42501'; END IF;
  SELECT organization_id INTO v_member_org FROM public.profiles WHERE id = p_member_id;
  IF v_member_org IS NULL THEN RAISE EXCEPTION 'member_not_found' USING errcode = 'P0002'; END IF;
  SELECT role, organization_id INTO v_caller_role, v_caller_org FROM public.profiles WHERE id = v_caller;
  IF v_caller_org IS NULL OR v_caller_org != v_member_org THEN
    RAISE EXCEPTION 'cross_org_forbidden' USING errcode = '42501';
  END IF;
  IF v_caller != p_member_id AND v_caller_role != 'owner' THEN
    RAISE EXCEPTION 'unauthorized' USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT
    pk.key, pk.category, pk.is_critical, pk.label_tr, pk.label_en, pk.sort_order,
    rdp.allowed AS default_allowed,
    po.allowed  AS override_allowed,
    COALESCE(po.allowed, rdp.allowed) AS effective_allowed
  FROM public.permission_keys pk
  JOIN public.role_default_permissions rdp
    ON rdp.key = pk.key
   AND rdp.role = (SELECT role FROM public.profiles WHERE id = p_member_id)
  LEFT JOIN public.permission_overrides po
    ON po.user_id = p_member_id AND po.key = pk.key
  ORDER BY pk.sort_order, pk.key;
END;
$$;
REVOKE ALL ON FUNCTION public.list_member_permissions(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_member_permissions(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_permission_override(
  p_member_id uuid,
  p_key text,
  p_allowed boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_org uuid;
  v_caller_role public.user_role;
  v_member_org uuid;
  v_member_role public.user_role;
  v_caller_has_key boolean;
  v_is_critical boolean;
  v_owner_id uuid;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'unauthorized' USING errcode = '42501'; END IF;

  SELECT organization_id, role INTO v_caller_org, v_caller_role
  FROM public.profiles WHERE id = v_caller;
  SELECT organization_id, role INTO v_member_org, v_member_role
  FROM public.profiles WHERE id = p_member_id;

  IF v_member_org IS NULL OR v_member_org != v_caller_org THEN
    RAISE EXCEPTION 'cross_org_forbidden' USING errcode = '42501';
  END IF;

  IF v_caller = p_member_id AND v_caller_role != 'owner' THEN
    RAISE EXCEPTION 'cannot_edit_own_permissions' USING errcode = '42501';
  END IF;

  IF v_caller_role != 'owner' THEN
    IF v_member_role = 'owner' THEN
      RAISE EXCEPTION 'cannot_edit_owner_permissions' USING errcode = '42501';
    END IF;
    IF p_allowed IS TRUE THEN
      SELECT public.has_permission(v_caller, p_key) INTO v_caller_has_key;
      IF NOT v_caller_has_key THEN
        RAISE EXCEPTION 'cannot_delegate_unowned_permission' USING errcode = '42501';
      END IF;
    END IF;
  END IF;

  IF p_allowed IS NULL THEN
    DELETE FROM public.permission_overrides
    WHERE user_id = p_member_id AND key = p_key;
  ELSE
    INSERT INTO public.permission_overrides (user_id, organization_id, key, allowed, granted_by)
    VALUES (p_member_id, v_member_org, p_key, p_allowed, v_caller)
    ON CONFLICT (user_id, key) DO UPDATE
      SET allowed    = EXCLUDED.allowed,
          granted_by = EXCLUDED.granted_by,
          updated_at = now();

    SELECT is_critical INTO v_is_critical FROM public.permission_keys WHERE key = p_key;
    IF v_is_critical AND v_caller_role != 'owner' AND p_allowed IS TRUE THEN
      SELECT id INTO v_owner_id
      FROM public.profiles
      WHERE organization_id = v_member_org AND role = 'owner'
      ORDER BY created_at ASC LIMIT 1;
      IF v_owner_id IS NOT NULL THEN
        INSERT INTO public.notifications (organization_id, recipient_id, actor_id, type, payload)
        VALUES (
          v_member_org, v_owner_id, v_caller, 'permission_grant',
          jsonb_build_object(
            'member_id', p_member_id,
            'key', p_key,
            'allowed', p_allowed,
            'granted_by', v_caller
          )
        );
      END IF;
    END IF;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.set_permission_override(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_permission_override(uuid, text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'unauthorized' USING errcode = '42501'; END IF;
  UPDATE public.notifications
  SET read_at = COALESCE(read_at, now())
  WHERE id = p_notification_id AND recipient_id = v_caller;
END;
$$;
REVOKE ALL ON FUNCTION public.mark_notification_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO authenticated;

ALTER TABLE public.permission_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "permission_keys_read_authed" ON public.permission_keys;
CREATE POLICY "permission_keys_read_authed" ON public.permission_keys
  FOR SELECT TO authenticated USING (true);

ALTER TABLE public.role_default_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "role_defaults_read_authed" ON public.role_default_permissions;
CREATE POLICY "role_defaults_read_authed" ON public.role_default_permissions
  FOR SELECT TO authenticated USING (true);

ALTER TABLE public.permission_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "permission_overrides_read" ON public.permission_overrides;
CREATE POLICY "permission_overrides_read" ON public.permission_overrides
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.organization_id = permission_overrides.organization_id
        AND p.role = 'owner'
    )
  );
DROP POLICY IF EXISTS "permission_overrides_block_direct_writes" ON public.permission_overrides;
CREATE POLICY "permission_overrides_block_direct_writes" ON public.permission_overrides
  FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "permission_overrides_block_direct_update" ON public.permission_overrides;
CREATE POLICY "permission_overrides_block_direct_update" ON public.permission_overrides
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "permission_overrides_block_direct_delete" ON public.permission_overrides;
CREATE POLICY "permission_overrides_block_direct_delete" ON public.permission_overrides
  FOR DELETE TO authenticated USING (false);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_read_self" ON public.notifications;
CREATE POLICY "notifications_read_self" ON public.notifications
  FOR SELECT TO authenticated USING (recipient_id = auth.uid());
DROP POLICY IF EXISTS "notifications_update_self" ON public.notifications;
CREATE POLICY "notifications_update_self" ON public.notifications
  FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());
DROP POLICY IF EXISTS "notifications_block_inserts" ON public.notifications;
CREATE POLICY "notifications_block_inserts" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "notifications_block_deletes" ON public.notifications;
CREATE POLICY "notifications_block_deletes" ON public.notifications
  FOR DELETE TO authenticated USING (false);;
