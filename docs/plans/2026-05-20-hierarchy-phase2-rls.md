# Hierarchy Phase 2 — Manager Scope RLS

> **Tarih:** 2026-05-20
> **Amaç:** Manager rolü sadece kendi `manager_id` altındaki şoförlerin jobs / vehicles / ride_requests / vehicle_assignments kayıtlarını görsün/güncellesin. Owner ve driver davranışları değişmez.

## Mevcut durum

- `profiles.manager_id` (uuid, nullable) kolonu var — driver hangi manager'a bağlı.
- `can_view_profile(uuid)` helper'ı zaten manager → kendi driver'ı kuralını uyguluyor (`profiles` SELECT policy üzerinden).
- Diğer tablolarda (jobs, vehicles, ride_requests, vehicle_assignments) policy'ler sadece `organization_id = current_user_org_id()` filtreliyor — manager TÜM org'u görüyor → veri sızıntısı riski.

Canlı DB'de henüz manager profili yok (audit: tek owner+driver+customer), ama scope filter olmadan ilk manager eklendiğinde otomatik tüm org'a erişir.

## Tasarım

### Helper: `current_user_can_see_user(target_user_id uuid)`

Tek noktadan scope kararı. Mantık:

- `target_user_id = auth.uid()` → true
- Farklı org → false
- Caller `owner` → true
- Caller `manager`:
  - target `driver` → `profiles.manager_id = auth.uid()`
  - target `owner` veya `manager` → true (peer/üst)
- Caller `driver` → sadece kendisi

`can_view_profile` ile aynı mantık ama "kendi"yi daha geniş kullandığımız için ayrı bir fonksiyon (SECURITY DEFINER, STABLE).

### Etkilenen policy'ler

| Tablo | Policy | Değişiklik |
|---|---|---|
| jobs | `org_read_jobs` | manager için `current_user_can_see_user(driver_id) OR driver_id IS NULL OR created_by = auth.uid()` |
| jobs | `members_update_jobs` | manager için scope filter |
| vehicles | `org_read_vehicles` | manager için scope (current_user_id) |
| vehicles | `owner_manager_update_vehicles` | manager için scope |
| ride_requests | `rr_org_staff_select` | manager için scope (driver_id) |
| vehicle_assignments | `va_org_read` | manager için scope (user_id) |
| vehicle_assignments | `va_update_self` | manager için scope |

Driver policy'leri **değişmez** (mevcut akış: driver tüm org'u SELECT'lerken kod tarafında `listMyJobs(driverId)` ile filtre — defense-in-depth ayrı bir iş kalemi).

## SQL

```sql
-- 1) Helper
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

-- 2) jobs — SELECT
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

-- 3) jobs — UPDATE
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

-- 4) vehicles — SELECT
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

-- 5) vehicles — UPDATE
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

-- 6) ride_requests — staff SELECT
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

-- 7) vehicle_assignments — SELECT
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

-- 8) vehicle_assignments — UPDATE
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
```

## Test plan (post-migration)

Manuel SQL test (Supabase SQL Editor → `set role authenticated; set request.jwt.claim.sub = '<uid>';`):

| Senaryo | Beklenen |
|---|---|
| Owner X → `SELECT * FROM jobs` | Tüm org jobs |
| Manager M (manager_id = X için 2 driver) → SELECT jobs | M'in 2 driver'ının jobs + havuz + kendi yarattıkları |
| Manager M → SELECT vehicles | M'in driver'larının araçları + havuz |
| Manager M → SELECT ride_requests | Sadece M'in driver'larının ride'ları |
| Manager M → başka manager'ın driver'ının job'ını UPDATE | RLS 0 row affected |
| Driver D → SELECT jobs | Mevcut davranış (org tümü — kod tarafında filter) |
| Owner X → SELECT vehicle_assignments | Tüm org |

Henüz canlı manager profili yok, bu yüzden seed bir manager + 2 driver hierarşi ile smoke test:

```sql
-- Sample seed (test sonrası temizlenir):
INSERT INTO profiles (id, organization_id, full_name, role, email, status)
VALUES (gen_random_uuid(), '<org>', 'Test Manager', 'manager', 'tm@x', 'active');
UPDATE profiles SET manager_id = '<manager_id>' WHERE id IN ('<driver1>', '<driver2>');
```

## Rollback

```sql
-- Eski policy'leri geri yükle (sadece scope filter kaldırır):
DROP POLICY IF EXISTS org_read_jobs ON jobs;
CREATE POLICY org_read_jobs ON jobs FOR SELECT TO authenticated
USING (organization_id = current_user_org_id());
-- ... (her policy için aynı pattern)
DROP FUNCTION IF EXISTS public.current_user_can_see_user(uuid);
```

## Frontend etkisi

Fetch'ler RLS'e güveniyor (`fleet/src/lib/jobs.ts`, `vehicles.ts`, `rideHistory.ts` — `organization_id` filtresi + SELECT). RLS daraldığında UI otomatik filtrelenir, kod değişikliği gerekmez.

`ride_search_vehicles` ve `claim_vehicle_for_ride` SECURITY DEFINER olduğu için ride matching etkilenmez.

## Migration adı

`hierarchy_phase2_manager_scope_rls`
