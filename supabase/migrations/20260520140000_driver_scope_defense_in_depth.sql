-- Driver-side RLS daraltma (defense-in-depth)
-- Hierarchy Phase 2 manager scope eklemisti; driver hala unconditional SELECT
-- iznine sahipti. UI tarafinda listMyJobs / listOpenJobs cagriliyor (kod-side
-- filter), ama RLS bypass riski. Bu migration driver scope'u da kisitlar:
--
-- jobs:
--   - driver kendi atanan job'lari (driver_id = auth.uid())
--   - veya havuzda (status = 'open' AND driver_id IS NULL)
--
-- vehicles:
--   - driver uzerindeki araclar (current_user_id = auth.uid())
--   - veya bos havuz (current_user_id IS NULL) - "Uzerine Al" icin gerek
--
-- Owner ve manager scope degismiyor (Phase 2 helper current_user_can_see_user
-- ile aynen).

-- 1) jobs SELECT
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
    OR (current_user_role() = 'driver' AND (
      driver_id = auth.uid()
      OR (status = 'open' AND driver_id IS NULL)
    ))
  )
);

-- 2) vehicles SELECT
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
    OR (current_user_role() = 'driver' AND (
      current_user_id = auth.uid()
      OR current_user_id IS NULL
    ))
  )
);
