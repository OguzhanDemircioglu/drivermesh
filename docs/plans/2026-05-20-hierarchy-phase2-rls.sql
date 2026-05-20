-- Migration: hierarchy_phase2_manager_scope_rls
-- Tarih: 2026-05-20
-- Plan: docs/plans/2026-05-20-hierarchy-phase2-rls.md
-- Calistirma: Supabase Dashboard -> SQL Editor -> paste -> Run

-- 1) Helper: manager-driver scope check
CREATE OR REPLACE FUNCTION public.current_user_can_see_user(p_target_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT CASE
    WHEN p_target_user_id IS NULL THEN false
    WHEN p_target_user_id = auth.uid() THEN true
    WHEN (SELECT organization_id FROM profiles WHERE id = auth.uid())
      IS DISTINCT FROM
      (SELECT organization_id FROM profiles WHERE id = p_target_user_id) THEN false
    WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'owner' THEN true
    WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'manager' THEN
      CASE
        WHEN (SELECT role FROM profiles WHERE id = p_target_user_id) = 'driver'
          THEN (SELECT manager_id FROM profiles WHERE id = p_target_user_id) = auth.uid()
        ELSE true
      END
    ELSE false
  END;
$$;

REVOKE EXECUTE ON FUNCTION public.current_user_can_see_user(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.current_user_can_see_user(uuid) TO authenticated;

-- 2) jobs SELECT
DROP POLICY IF EXISTS org_read_jobs ON public.jobs;
CREATE POLICY org_read_jobs ON public.jobs
FOR SELECT TO authenticated
USING (
  organization_id = current_user_org_id()
  AND (
    current_user_role() = 'owner'
    OR (current_user_role() = 'manager' AND (
      driver_id IS NULL
      OR created_by = auth.uid()
      OR current_user_can_see_user(driver_id)
    ))
    OR current_user_role() = 'driver'
  )
);

-- 3) jobs UPDATE
DROP POLICY IF EXISTS members_update_jobs ON public.jobs;
CREATE POLICY members_update_jobs ON public.jobs
FOR UPDATE TO authenticated
USING (
  organization_id = current_user_org_id()
  AND (
    current_user_role() = 'owner'
    OR (current_user_role() = 'manager' AND (
      driver_id IS NULL
      OR created_by = auth.uid()
      OR current_user_can_see_user(driver_id)
    ))
    OR (current_user_role() = 'driver' AND (
      driver_id = auth.uid()
      OR (status = 'open' AND driver_id IS NULL)
    ))
  )
)
WITH CHECK (
  organization_id = current_user_org_id()
  AND (
    current_user_role() = 'owner'
    OR (current_user_role() = 'manager' AND (
      driver_id IS NULL
      OR created_by = auth.uid()
      OR current_user_can_see_user(driver_id)
    ))
    OR (current_user_role() = 'driver' AND driver_id = auth.uid())
  )
);

-- 4) vehicles SELECT
DROP POLICY IF EXISTS org_read_vehicles ON public.vehicles;
CREATE POLICY org_read_vehicles ON public.vehicles
FOR SELECT TO authenticated
USING (
  organization_id = current_user_org_id()
  AND (
    current_user_role() = 'owner'
    OR (current_user_role() = 'manager' AND (
      current_user_id IS NULL
      OR current_user_can_see_user(current_user_id)
    ))
    OR current_user_role() = 'driver'
  )
);

-- 5) vehicles UPDATE
DROP POLICY IF EXISTS owner_manager_update_vehicles ON public.vehicles;
CREATE POLICY owner_manager_update_vehicles ON public.vehicles
FOR UPDATE TO authenticated
USING (
  organization_id = current_user_org_id()
  AND (
    current_user_role() = 'owner'
    OR (current_user_role() = 'manager' AND (
      current_user_id IS NULL
      OR current_user_can_see_user(current_user_id)
    ))
  )
)
WITH CHECK (
  organization_id = current_user_org_id()
  AND (
    current_user_role() = 'owner'
    OR (current_user_role() = 'manager' AND (
      current_user_id IS NULL
      OR current_user_can_see_user(current_user_id)
    ))
  )
);

-- 6) ride_requests staff SELECT
DROP POLICY IF EXISTS rr_org_staff_select ON public.ride_requests;
CREATE POLICY rr_org_staff_select ON public.ride_requests
FOR SELECT TO public
USING (
  organization_id = (SELECT p.organization_id FROM profiles p WHERE p.id = auth.uid())
  AND (
    (SELECT p.role FROM profiles p WHERE p.id = auth.uid()) = 'owner'
    OR (
      (SELECT p.role FROM profiles p WHERE p.id = auth.uid()) = 'manager'
      AND (driver_id IS NULL OR current_user_can_see_user(driver_id))
    )
  )
);

-- 7) vehicle_assignments SELECT
DROP POLICY IF EXISTS va_org_read ON public.vehicle_assignments;
CREATE POLICY va_org_read ON public.vehicle_assignments
FOR SELECT TO public
USING (
  organization_id = current_user_org_id()
  AND (
    current_user_role() = 'owner'
    OR (current_user_role() = 'manager' AND current_user_can_see_user(user_id))
    OR (current_user_role() = 'driver' AND user_id = auth.uid())
  )
);

-- 8) vehicle_assignments UPDATE
DROP POLICY IF EXISTS va_update_self ON public.vehicle_assignments;
CREATE POLICY va_update_self ON public.vehicle_assignments
FOR UPDATE TO public
USING (
  organization_id = current_user_org_id()
  AND (
    current_user_role() = 'owner'
    OR (current_user_role() = 'manager' AND current_user_can_see_user(user_id))
    OR (current_user_role() = 'driver' AND user_id = auth.uid())
  )
)
WITH CHECK (
  organization_id = current_user_org_id()
  AND (
    current_user_role() = 'owner'
    OR (current_user_role() = 'manager' AND current_user_can_see_user(user_id))
    OR (current_user_role() = 'driver' AND user_id = auth.uid())
  )
);
