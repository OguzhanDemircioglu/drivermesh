-- multiple_permissive_policies konsolidasyonu
-- Supabase performance advisor: 12 tablo+cmd kombinasyonunda 2+ permissive
-- policy aynı role için çalışıyordu → her query için tüm policy'ler OR'lanır.
--
-- Pattern A: `*_write` policy (FOR ALL) + `*_select` policy (FOR SELECT)
--   → write'in SELECT'te etkisi gereksiz, write'i 3 ayrı INSERT/UPDATE/DELETE
--     policy'ye böleriz; select tek başına SELECT'i yönetir.
--   Etkilenen: chat_thread_members, garages, shifts, vehicle_assignments,
--              vehicle_maintenance, vehicles
--
-- Pattern B: İki SELECT-only permissive policy → OR ile tek policy
--   Etkilenen: audit_logs, users, ride_offers, ride_requests
--
-- Pattern C: İki UPDATE permissive policy → OR ile tek policy (USING + WITH CHECK)
--   Etkilenen: leave_requests
--
-- Davranış değişmez (OR semantiği korunur); sadece PG her satır için tek
-- policy değerlendirir → daha hızlı.

BEGIN;

-- =====================================================
-- 1) filoLocal.audit_logs SELECT (Pattern B)
-- =====================================================
DROP POLICY IF EXISTS "audit_select_actor" ON "filoLocal"."audit_logs";
DROP POLICY IF EXISTS "audit_select_patron" ON "filoLocal"."audit_logs";
CREATE POLICY "audit_select" ON "filoLocal"."audit_logs"
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    (actor_id = (SELECT auth.uid()))
    OR ("filoLocal".is_patron() AND (company_id = "filoLocal".current_company_id()))
  );

-- =====================================================
-- 2) filoLocal.chat_thread_members (Pattern A — ALL ile çakışan SELECT + UPDATE)
-- =====================================================
DROP POLICY IF EXISTS "thread_members_manage" ON "filoLocal"."chat_thread_members";
-- thread_members_self_select (SELECT) kalır — manager case'ini de OR ediyor
-- thread_members_update_self (UPDATE) kalır — kullanıcı kendi member'ı güncelliyor
-- Manage için INSERT + DELETE policy'lerini ekle (UPDATE'i self_update kapsıyor):
CREATE POLICY "thread_members_manage_insert" ON "filoLocal"."chat_thread_members"
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "filoLocal".chat_threads th
      WHERE th.id = chat_thread_members.thread_id
        AND th.company_id = "filoLocal".current_company_id()
        AND "filoLocal".is_manager_or_above()
    )
  );
CREATE POLICY "thread_members_manage_delete" ON "filoLocal"."chat_thread_members"
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "filoLocal".chat_threads th
      WHERE th.id = chat_thread_members.thread_id
        AND th.company_id = "filoLocal".current_company_id()
        AND "filoLocal".is_manager_or_above()
    )
  );

-- =====================================================
-- 3) filoLocal.garages (Pattern A)
-- =====================================================
DROP POLICY IF EXISTS "garages_write" ON "filoLocal"."garages";
-- garages_select (SELECT) kalır
CREATE POLICY "garages_insert" ON "filoLocal"."garages"
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ("filoLocal".is_manager_or_above() AND (company_id = "filoLocal".current_company_id()));
CREATE POLICY "garages_update" ON "filoLocal"."garages"
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING ("filoLocal".is_manager_or_above() AND (company_id = "filoLocal".current_company_id()))
  WITH CHECK ("filoLocal".is_manager_or_above() AND (company_id = "filoLocal".current_company_id()));
CREATE POLICY "garages_delete" ON "filoLocal"."garages"
  AS PERMISSIVE FOR DELETE TO authenticated
  USING ("filoLocal".is_manager_or_above() AND (company_id = "filoLocal".current_company_id()));

-- =====================================================
-- 4) filoLocal.leave_requests UPDATE (Pattern C)
-- =====================================================
DROP POLICY IF EXISTS "leave_cancel_own" ON "filoLocal"."leave_requests";
DROP POLICY IF EXISTS "leave_decide_manager" ON "filoLocal"."leave_requests";
CREATE POLICY "leave_update" ON "filoLocal"."leave_requests"
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    ((driver_id = (SELECT auth.uid())) AND (status = 'pending'::"filoLocal".leave_status))
    OR ("filoLocal".is_manager_or_above() AND (company_id = "filoLocal".current_company_id()))
  )
  WITH CHECK (
    ((driver_id = (SELECT auth.uid())) AND (status = ANY (ARRAY['pending'::"filoLocal".leave_status, 'cancelled'::"filoLocal".leave_status])))
    OR ("filoLocal".is_manager_or_above() AND (company_id = "filoLocal".current_company_id()))
  );

-- =====================================================
-- 5) filoLocal.shifts (Pattern A)
-- =====================================================
DROP POLICY IF EXISTS "shifts_write" ON "filoLocal"."shifts";
CREATE POLICY "shifts_insert" ON "filoLocal"."shifts"
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ("filoLocal".is_manager_or_above() AND (company_id = "filoLocal".current_company_id()));
CREATE POLICY "shifts_update" ON "filoLocal"."shifts"
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING ("filoLocal".is_manager_or_above() AND (company_id = "filoLocal".current_company_id()))
  WITH CHECK ("filoLocal".is_manager_or_above() AND (company_id = "filoLocal".current_company_id()));
CREATE POLICY "shifts_delete" ON "filoLocal"."shifts"
  AS PERMISSIVE FOR DELETE TO authenticated
  USING ("filoLocal".is_manager_or_above() AND (company_id = "filoLocal".current_company_id()));

-- =====================================================
-- 6) filoLocal.users SELECT (Pattern B)
-- =====================================================
DROP POLICY IF EXISTS "users_select_self" ON "filoLocal"."users";
DROP POLICY IF EXISTS "users_select_company" ON "filoLocal"."users";
CREATE POLICY "users_select" ON "filoLocal"."users"
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    (id = (SELECT auth.uid()))
    OR (
      "filoLocal".is_employee()
      AND EXISTS (
        SELECT 1 FROM "filoLocal".company_members cm
        WHERE cm.user_id = users.id
          AND cm.company_id = "filoLocal".current_company_id()
          AND cm.deleted_at IS NULL
      )
    )
  );

-- =====================================================
-- 7) filoLocal.vehicle_assignments (Pattern A)
-- =====================================================
DROP POLICY IF EXISTS "assignments_write" ON "filoLocal"."vehicle_assignments";
CREATE POLICY "assignments_insert" ON "filoLocal"."vehicle_assignments"
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ("filoLocal".is_manager_or_above() AND (company_id = "filoLocal".current_company_id()));
CREATE POLICY "assignments_update" ON "filoLocal"."vehicle_assignments"
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING ("filoLocal".is_manager_or_above() AND (company_id = "filoLocal".current_company_id()))
  WITH CHECK ("filoLocal".is_manager_or_above() AND (company_id = "filoLocal".current_company_id()));
CREATE POLICY "assignments_delete" ON "filoLocal"."vehicle_assignments"
  AS PERMISSIVE FOR DELETE TO authenticated
  USING ("filoLocal".is_manager_or_above() AND (company_id = "filoLocal".current_company_id()));

-- =====================================================
-- 8) filoLocal.vehicle_maintenance (Pattern A)
-- =====================================================
DROP POLICY IF EXISTS "maintenance_write" ON "filoLocal"."vehicle_maintenance";
CREATE POLICY "maintenance_insert" ON "filoLocal"."vehicle_maintenance"
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ("filoLocal".is_manager_or_above() AND (company_id = "filoLocal".current_company_id()));
CREATE POLICY "maintenance_update" ON "filoLocal"."vehicle_maintenance"
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING ("filoLocal".is_manager_or_above() AND (company_id = "filoLocal".current_company_id()))
  WITH CHECK ("filoLocal".is_manager_or_above() AND (company_id = "filoLocal".current_company_id()));
CREATE POLICY "maintenance_delete" ON "filoLocal"."vehicle_maintenance"
  AS PERMISSIVE FOR DELETE TO authenticated
  USING ("filoLocal".is_manager_or_above() AND (company_id = "filoLocal".current_company_id()));

-- =====================================================
-- 9) filoLocal.vehicles (Pattern A)
-- =====================================================
DROP POLICY IF EXISTS "vehicles_write" ON "filoLocal"."vehicles";
CREATE POLICY "vehicles_insert" ON "filoLocal"."vehicles"
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ("filoLocal".is_manager_or_above() AND (company_id = "filoLocal".current_company_id()));
CREATE POLICY "vehicles_update" ON "filoLocal"."vehicles"
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING ("filoLocal".is_manager_or_above() AND (company_id = "filoLocal".current_company_id()))
  WITH CHECK ("filoLocal".is_manager_or_above() AND (company_id = "filoLocal".current_company_id()));
CREATE POLICY "vehicles_delete" ON "filoLocal"."vehicles"
  AS PERMISSIVE FOR DELETE TO authenticated
  USING ("filoLocal".is_manager_or_above() AND (company_id = "filoLocal".current_company_id()));

-- =====================================================
-- 10) public.ride_offers SELECT (Pattern B, role public)
-- =====================================================
DROP POLICY IF EXISTS "ro_customer_select" ON "public"."ride_offers";
DROP POLICY IF EXISTS "ro_driver_select" ON "public"."ride_offers";
CREATE POLICY "ride_offers_select" ON "public"."ride_offers"
  AS PERMISSIVE FOR SELECT TO public
  USING (
    (driver_id = (SELECT auth.uid()))
    OR (ride_request_id IN (
      SELECT ride_requests.id FROM ride_requests
      WHERE ride_requests.customer_id IN (
        SELECT customers.id FROM customers
        WHERE customers.auth_user_id = (SELECT auth.uid())
      )
    ))
  );

-- =====================================================
-- 11) public.ride_requests SELECT (Pattern B, role public, 3 way)
-- =====================================================
DROP POLICY IF EXISTS "rr_customer_select" ON "public"."ride_requests";
DROP POLICY IF EXISTS "rr_driver_select" ON "public"."ride_requests";
DROP POLICY IF EXISTS "rr_org_staff_select" ON "public"."ride_requests";
CREATE POLICY "ride_requests_select" ON "public"."ride_requests"
  AS PERMISSIVE FOR SELECT TO public
  USING (
    (driver_id = (SELECT auth.uid()))
    OR (customer_id IN (
      SELECT customers.id FROM customers
      WHERE customers.auth_user_id = (SELECT auth.uid())
    ))
    OR (
      (organization_id = (SELECT p.organization_id FROM profiles p WHERE p.id = (SELECT auth.uid())))
      AND (
        ((SELECT p.role FROM profiles p WHERE p.id = (SELECT auth.uid())) = 'owner'::user_role)
        OR (
          ((SELECT p.role FROM profiles p WHERE p.id = (SELECT auth.uid())) = 'manager'::user_role)
          AND ((driver_id IS NULL) OR current_user_can_see_user(driver_id))
        )
      )
    )
  );

COMMIT;
