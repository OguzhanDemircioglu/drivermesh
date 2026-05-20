-- =============================================================
-- DriverMesh2 — initial schema
-- Roles + Organizations + Profiles + Invitations + Vehicles + Jobs
-- =============================================================

-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('owner','manager','driver');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.vehicle_status AS ENUM ('active','maintenance','idle');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.job_status AS ENUM ('open','assigned','in_progress','completed','failed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.invitation_status AS ENUM ('pending','accepted','expired','revoked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ TABLES ============
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  role public.user_role NOT NULL,
  email text NOT NULL,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role public.user_role NOT NULL CHECK (role IN ('manager','driver')),
  token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.invitation_status NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plate text NOT NULL,
  brand text NOT NULL,
  model text NOT NULL,
  year int NOT NULL CHECK (year >= 1990 AND year <= 2100),
  photo_url text,
  status public.vehicle_status NOT NULL DEFAULT 'idle',
  added_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, plate)
);

CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  pickup_address text NOT NULL,
  dropoff_address text NOT NULL,
  distance_km numeric(8,2),
  eta_minutes int,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.job_status NOT NULL DEFAULT 'open',
  fail_reason text,
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  assigned_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz
);

-- ============ INDEXES ============
CREATE INDEX IF NOT EXISTS idx_profiles_org ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_invitations_org ON public.invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.invitations(lower(email));
CREATE INDEX IF NOT EXISTS idx_vehicles_org ON public.vehicles(organization_id);
CREATE INDEX IF NOT EXISTS idx_jobs_org ON public.jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_jobs_driver ON public.jobs(driver_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);

-- ============ HELPER FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

-- ============ NEW USER TRIGGER ============
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
    v_org_id := NULL;
  END IF;

  INSERT INTO public.profiles (id, organization_id, full_name, role, email)
  VALUES (NEW.id, v_org_id, v_full_name, v_role, NEW.email);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ BACKFILL EXISTING USERS ============
-- Var olan kullanıcılar için profile + organization (eğer yoksa)
INSERT INTO public.organizations (name, owner_id)
SELECT
  COALESCE(u.raw_user_meta_data->>'company_name', split_part(u.email, '@', 1) || ' Filo'),
  u.id
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
  AND COALESCE(u.raw_user_meta_data->>'role', 'owner') = 'owner'
  AND NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.owner_id = u.id);

INSERT INTO public.profiles (id, organization_id, full_name, role, email)
SELECT
  u.id,
  (SELECT o.id FROM public.organizations o WHERE o.owner_id = u.id LIMIT 1),
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  COALESCE((u.raw_user_meta_data->>'role')::public.user_role, 'owner'),
  u.email
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);

-- ============ ROW LEVEL SECURITY ============
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Organizations
DROP POLICY IF EXISTS "members_view_own_org" ON public.organizations;
CREATE POLICY "members_view_own_org" ON public.organizations FOR SELECT TO authenticated
  USING (id = public.current_user_org_id());

DROP POLICY IF EXISTS "owner_update_org" ON public.organizations;
CREATE POLICY "owner_update_org" ON public.organizations FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- Profiles
DROP POLICY IF EXISTS "view_self_or_org_members" ON public.profiles;
CREATE POLICY "view_self_or_org_members" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR organization_id = public.current_user_org_id());

DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;
CREATE POLICY "update_own_profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Invitations
DROP POLICY IF EXISTS "owner_manager_view_invitations" ON public.invitations;
CREATE POLICY "owner_manager_view_invitations" ON public.invitations FOR SELECT TO authenticated
  USING (
    organization_id = public.current_user_org_id()
    AND public.current_user_role() IN ('owner','manager')
  );

DROP POLICY IF EXISTS "owner_manager_create_invitations" ON public.invitations;
CREATE POLICY "owner_manager_create_invitations" ON public.invitations FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_user_org_id()
    AND public.current_user_role() IN ('owner','manager')
    AND invited_by = auth.uid()
    AND role IN ('manager','driver')
  );

DROP POLICY IF EXISTS "owner_manager_revoke_invitations" ON public.invitations;
CREATE POLICY "owner_manager_revoke_invitations" ON public.invitations FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_user_org_id()
    AND public.current_user_role() IN ('owner','manager')
  );

-- Vehicles
DROP POLICY IF EXISTS "org_read_vehicles" ON public.vehicles;
CREATE POLICY "org_read_vehicles" ON public.vehicles FOR SELECT TO authenticated
  USING (organization_id = public.current_user_org_id());

DROP POLICY IF EXISTS "owner_manager_add_vehicles" ON public.vehicles;
CREATE POLICY "owner_manager_add_vehicles" ON public.vehicles FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_user_org_id()
    AND public.current_user_role() IN ('owner','manager')
    AND added_by = auth.uid()
  );

DROP POLICY IF EXISTS "owner_manager_update_vehicles" ON public.vehicles;
CREATE POLICY "owner_manager_update_vehicles" ON public.vehicles FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_user_org_id()
    AND public.current_user_role() IN ('owner','manager')
  );

DROP POLICY IF EXISTS "owner_delete_vehicles" ON public.vehicles;
CREATE POLICY "owner_delete_vehicles" ON public.vehicles FOR DELETE TO authenticated
  USING (
    organization_id = public.current_user_org_id()
    AND public.current_user_role() = 'owner'
  );

-- Jobs
DROP POLICY IF EXISTS "org_read_jobs" ON public.jobs;
CREATE POLICY "org_read_jobs" ON public.jobs FOR SELECT TO authenticated
  USING (organization_id = public.current_user_org_id());

DROP POLICY IF EXISTS "owner_manager_create_jobs" ON public.jobs;
CREATE POLICY "owner_manager_create_jobs" ON public.jobs FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_user_org_id()
    AND public.current_user_role() IN ('owner','manager')
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "members_update_jobs" ON public.jobs;
CREATE POLICY "members_update_jobs" ON public.jobs FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_user_org_id()
    AND (
      public.current_user_role() IN ('owner','manager')
      OR (public.current_user_role() = 'driver' AND driver_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "owner_manager_delete_jobs" ON public.jobs;
CREATE POLICY "owner_manager_delete_jobs" ON public.jobs FOR DELETE TO authenticated
  USING (
    organization_id = public.current_user_org_id()
    AND public.current_user_role() IN ('owner','manager')
  );;
