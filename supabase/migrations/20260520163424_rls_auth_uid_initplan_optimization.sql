-- RLS auth_rls_initplan optimization
-- Supabase performance advisor: 72 policy 'auth.X()' her satır için
-- yeniden değerlendiriyordu. `(SELECT auth.X())` ile wrap edildiğinde
-- PostgreSQL initplan optimization devreye girer → tek call.
-- Üretilen: scripts/build_rls_initplan_migration.py

BEGIN;

-- filoLocal.audit_logs / audit_select_actor
DROP POLICY IF EXISTS "audit_select_actor" ON "filoLocal"."audit_logs";
CREATE POLICY "audit_select_actor" ON "filoLocal"."audit_logs"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((actor_id = (SELECT auth.uid())));

-- filoLocal.chat_messages / chat_msg_insert_self
DROP POLICY IF EXISTS "chat_msg_insert_self" ON "filoLocal"."chat_messages";
CREATE POLICY "chat_msg_insert_self" ON "filoLocal"."chat_messages"
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (("filoLocal".is_employee() AND (sender_id = (SELECT auth.uid())) AND (company_id = "filoLocal".current_company_id())));

-- filoLocal.chat_messages / chat_msg_select
DROP POLICY IF EXISTS "chat_msg_select" ON "filoLocal"."chat_messages";
CREATE POLICY "chat_msg_select" ON "filoLocal"."chat_messages"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (("filoLocal".is_employee() AND (company_id = "filoLocal".current_company_id()) AND (deleted_at IS NULL) AND ((EXISTS ( SELECT 1
   FROM "filoLocal".chat_thread_members tm
  WHERE ((tm.thread_id = chat_messages.thread_id) AND (tm.user_id = (SELECT auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM "filoLocal".chat_threads th
  WHERE ((th.id = chat_messages.thread_id) AND th.is_company_default))))));

-- filoLocal.chat_messages / chat_msg_soft_delete_self
DROP POLICY IF EXISTS "chat_msg_soft_delete_self" ON "filoLocal"."chat_messages";
CREATE POLICY "chat_msg_soft_delete_self" ON "filoLocal"."chat_messages"
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING ((sender_id = (SELECT auth.uid())))
  WITH CHECK ((sender_id = (SELECT auth.uid())));

-- filoLocal.chat_thread_members / thread_members_self_select
DROP POLICY IF EXISTS "thread_members_self_select" ON "filoLocal"."chat_thread_members";
CREATE POLICY "thread_members_self_select" ON "filoLocal"."chat_thread_members"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (((user_id = (SELECT auth.uid())) OR (EXISTS ( SELECT 1
   FROM "filoLocal".chat_threads th
  WHERE ((th.id = chat_thread_members.thread_id) AND (th.company_id = "filoLocal".current_company_id()) AND "filoLocal".is_manager_or_above())))));

-- filoLocal.chat_thread_members / thread_members_update_self
DROP POLICY IF EXISTS "thread_members_update_self" ON "filoLocal"."chat_thread_members";
CREATE POLICY "thread_members_update_self" ON "filoLocal"."chat_thread_members"
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING ((user_id = (SELECT auth.uid())))
  WITH CHECK ((user_id = (SELECT auth.uid())));

-- filoLocal.chat_threads / threads_select
DROP POLICY IF EXISTS "threads_select" ON "filoLocal"."chat_threads";
CREATE POLICY "threads_select" ON "filoLocal"."chat_threads"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (("filoLocal".is_employee() AND (company_id = "filoLocal".current_company_id()) AND (is_company_default OR (EXISTS ( SELECT 1
   FROM "filoLocal".chat_thread_members tm
  WHERE ((tm.thread_id = chat_threads.id) AND (tm.user_id = (SELECT auth.uid()))))))));

-- filoLocal.companies / companies_insert
DROP POLICY IF EXISTS "companies_insert" ON "filoLocal"."companies";
CREATE POLICY "companies_insert" ON "filoLocal"."companies"
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK ((owner_id = (SELECT auth.uid())));

-- filoLocal.companies / companies_select
DROP POLICY IF EXISTS "companies_select" ON "filoLocal"."companies";
CREATE POLICY "companies_select" ON "filoLocal"."companies"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (("filoLocal".is_employee() AND ((id = "filoLocal".current_company_id()) OR (owner_id = (SELECT auth.uid()))) AND (deleted_at IS NULL)));

-- filoLocal.device_tokens / device_tokens_self
DROP POLICY IF EXISTS "device_tokens_self" ON "filoLocal"."device_tokens";
CREATE POLICY "device_tokens_self" ON "filoLocal"."device_tokens"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING ((user_id = (SELECT auth.uid())))
  WITH CHECK ((user_id = (SELECT auth.uid())));

-- filoLocal.driver_documents / driver_docs_insert_own
DROP POLICY IF EXISTS "driver_docs_insert_own" ON "filoLocal"."driver_documents";
CREATE POLICY "driver_docs_insert_own" ON "filoLocal"."driver_documents"
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (("filoLocal".is_employee() AND (driver_id = (SELECT auth.uid())) AND (company_id = "filoLocal".current_company_id())));

-- filoLocal.driver_documents / driver_docs_select_own
DROP POLICY IF EXISTS "driver_docs_select_own" ON "filoLocal"."driver_documents";
CREATE POLICY "driver_docs_select_own" ON "filoLocal"."driver_documents"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (("filoLocal".is_employee() AND ((driver_id = (SELECT auth.uid())) OR ((company_id = "filoLocal".current_company_id()) AND "filoLocal".is_manager_or_above())) AND (deleted_at IS NULL)));

-- filoLocal.driver_statuses / driver_status_update_own
DROP POLICY IF EXISTS "driver_status_update_own" ON "filoLocal"."driver_statuses";
CREATE POLICY "driver_status_update_own" ON "filoLocal"."driver_statuses"
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (((driver_id = (SELECT auth.uid())) OR ("filoLocal".is_manager_or_above() AND (company_id = "filoLocal".current_company_id()))))
  WITH CHECK (((driver_id = (SELECT auth.uid())) OR ("filoLocal".is_manager_or_above() AND (company_id = "filoLocal".current_company_id()))));

-- filoLocal.driver_statuses / driver_status_upsert_own
DROP POLICY IF EXISTS "driver_status_upsert_own" ON "filoLocal"."driver_statuses";
CREATE POLICY "driver_status_upsert_own" ON "filoLocal"."driver_statuses"
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (("filoLocal".is_employee() AND (driver_id = (SELECT auth.uid())) AND (company_id = "filoLocal".current_company_id())));

-- filoLocal.feedback / feedback_self
DROP POLICY IF EXISTS "feedback_self" ON "filoLocal"."feedback";
CREATE POLICY "feedback_self" ON "filoLocal"."feedback"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING ((user_id = (SELECT auth.uid())))
  WITH CHECK ((user_id = (SELECT auth.uid())));

-- filoLocal.incidents / incidents_insert_self
DROP POLICY IF EXISTS "incidents_insert_self" ON "filoLocal"."incidents";
CREATE POLICY "incidents_insert_self" ON "filoLocal"."incidents"
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (("filoLocal".is_employee() AND (reporter_id = (SELECT auth.uid())) AND (company_id = "filoLocal".current_company_id())));

-- filoLocal.incidents / incidents_select
DROP POLICY IF EXISTS "incidents_select" ON "filoLocal"."incidents";
CREATE POLICY "incidents_select" ON "filoLocal"."incidents"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (("filoLocal".is_employee() AND ((reporter_id = (SELECT auth.uid())) OR (driver_id = (SELECT auth.uid())) OR ((company_id = "filoLocal".current_company_id()) AND "filoLocal".is_manager_or_above()))));

-- filoLocal.invitations / invitations_insert
DROP POLICY IF EXISTS "invitations_insert" ON "filoLocal"."invitations";
CREATE POLICY "invitations_insert" ON "filoLocal"."invitations"
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (("filoLocal".is_manager_or_above() AND (company_id = "filoLocal".current_company_id()) AND (invited_by = (SELECT auth.uid()))));

-- filoLocal.jobs / jobs_insert_manager
DROP POLICY IF EXISTS "jobs_insert_manager" ON "filoLocal"."jobs";
CREATE POLICY "jobs_insert_manager" ON "filoLocal"."jobs"
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (("filoLocal".is_manager_or_above() AND (company_id = "filoLocal".current_company_id()) AND (created_by = (SELECT auth.uid()))));

-- filoLocal.jobs / jobs_select
DROP POLICY IF EXISTS "jobs_select" ON "filoLocal"."jobs";
CREATE POLICY "jobs_select" ON "filoLocal"."jobs"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (("filoLocal".is_employee() AND ((driver_id = (SELECT auth.uid())) OR (created_by = (SELECT auth.uid())) OR ((company_id = "filoLocal".current_company_id()) AND "filoLocal".is_manager_or_above()))));

-- filoLocal.jobs / jobs_update_driver_or_manager
DROP POLICY IF EXISTS "jobs_update_driver_or_manager" ON "filoLocal"."jobs";
CREATE POLICY "jobs_update_driver_or_manager" ON "filoLocal"."jobs"
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (((driver_id = (SELECT auth.uid())) OR ("filoLocal".is_manager_or_above() AND (company_id = "filoLocal".current_company_id()))))
  WITH CHECK (((driver_id = (SELECT auth.uid())) OR ("filoLocal".is_manager_or_above() AND (company_id = "filoLocal".current_company_id()))));

-- filoLocal.leave_requests / leave_cancel_own
DROP POLICY IF EXISTS "leave_cancel_own" ON "filoLocal"."leave_requests";
CREATE POLICY "leave_cancel_own" ON "filoLocal"."leave_requests"
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (((driver_id = (SELECT auth.uid())) AND (status = 'pending'::"filoLocal".leave_status)))
  WITH CHECK (((driver_id = (SELECT auth.uid())) AND (status = ANY (ARRAY['pending'::"filoLocal".leave_status, 'cancelled'::"filoLocal".leave_status]))));

-- filoLocal.leave_requests / leave_insert_own
DROP POLICY IF EXISTS "leave_insert_own" ON "filoLocal"."leave_requests";
CREATE POLICY "leave_insert_own" ON "filoLocal"."leave_requests"
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (("filoLocal".is_employee() AND (driver_id = (SELECT auth.uid())) AND (company_id = "filoLocal".current_company_id()) AND (status = 'pending'::"filoLocal".leave_status)));

-- filoLocal.leave_requests / leave_select
DROP POLICY IF EXISTS "leave_select" ON "filoLocal"."leave_requests";
CREATE POLICY "leave_select" ON "filoLocal"."leave_requests"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (("filoLocal".is_employee() AND ((driver_id = (SELECT auth.uid())) OR ((company_id = "filoLocal".current_company_id()) AND "filoLocal".is_manager_or_above()))));

-- filoLocal.legal_consents / consents_insert_self
DROP POLICY IF EXISTS "consents_insert_self" ON "filoLocal"."legal_consents";
CREATE POLICY "consents_insert_self" ON "filoLocal"."legal_consents"
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK ((user_id = (SELECT auth.uid())));

-- filoLocal.legal_consents / consents_select_self
DROP POLICY IF EXISTS "consents_select_self" ON "filoLocal"."legal_consents";
CREATE POLICY "consents_select_self" ON "filoLocal"."legal_consents"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((user_id = (SELECT auth.uid())));

-- filoLocal.message_receipts / receipts_select_self
DROP POLICY IF EXISTS "receipts_select_self" ON "filoLocal"."message_receipts";
CREATE POLICY "receipts_select_self" ON "filoLocal"."message_receipts"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((user_id = (SELECT auth.uid())));

-- filoLocal.message_receipts / receipts_update_self
DROP POLICY IF EXISTS "receipts_update_self" ON "filoLocal"."message_receipts";
CREATE POLICY "receipts_update_self" ON "filoLocal"."message_receipts"
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING ((user_id = (SELECT auth.uid())))
  WITH CHECK ((user_id = (SELECT auth.uid())));

-- filoLocal.message_receipts / receipts_upsert_self
DROP POLICY IF EXISTS "receipts_upsert_self" ON "filoLocal"."message_receipts";
CREATE POLICY "receipts_upsert_self" ON "filoLocal"."message_receipts"
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK ((user_id = (SELECT auth.uid())));

-- filoLocal.notifications / notif_select_self
DROP POLICY IF EXISTS "notif_select_self" ON "filoLocal"."notifications";
CREATE POLICY "notif_select_self" ON "filoLocal"."notifications"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((user_id = (SELECT auth.uid())));

-- filoLocal.notifications / notif_update_self
DROP POLICY IF EXISTS "notif_update_self" ON "filoLocal"."notifications";
CREATE POLICY "notif_update_self" ON "filoLocal"."notifications"
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING ((user_id = (SELECT auth.uid())))
  WITH CHECK ((user_id = (SELECT auth.uid())));

-- filoLocal.shift_logs / shift_logs_insert_own
DROP POLICY IF EXISTS "shift_logs_insert_own" ON "filoLocal"."shift_logs";
CREATE POLICY "shift_logs_insert_own" ON "filoLocal"."shift_logs"
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (("filoLocal".is_employee() AND (driver_id = (SELECT auth.uid())) AND (company_id = "filoLocal".current_company_id())));

-- filoLocal.shift_logs / shift_logs_select
DROP POLICY IF EXISTS "shift_logs_select" ON "filoLocal"."shift_logs";
CREATE POLICY "shift_logs_select" ON "filoLocal"."shift_logs"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (("filoLocal".is_employee() AND ((driver_id = (SELECT auth.uid())) OR ((company_id = "filoLocal".current_company_id()) AND "filoLocal".is_manager_or_above()))));

-- filoLocal.shift_logs / shift_logs_update_own
DROP POLICY IF EXISTS "shift_logs_update_own" ON "filoLocal"."shift_logs";
CREATE POLICY "shift_logs_update_own" ON "filoLocal"."shift_logs"
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING ((driver_id = (SELECT auth.uid())))
  WITH CHECK ((driver_id = (SELECT auth.uid())));

-- filoLocal.user_notification_prefs / unp_self
DROP POLICY IF EXISTS "unp_self" ON "filoLocal"."user_notification_prefs";
CREATE POLICY "unp_self" ON "filoLocal"."user_notification_prefs"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING ((user_id = (SELECT auth.uid())))
  WITH CHECK ((user_id = (SELECT auth.uid())));

-- filoLocal.users / users_insert_self
DROP POLICY IF EXISTS "users_insert_self" ON "filoLocal"."users";
CREATE POLICY "users_insert_self" ON "filoLocal"."users"
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK ((id = (SELECT auth.uid())));

-- filoLocal.users / users_select_self
DROP POLICY IF EXISTS "users_select_self" ON "filoLocal"."users";
CREATE POLICY "users_select_self" ON "filoLocal"."users"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((id = (SELECT auth.uid())));

-- filoLocal.users / users_update_self
DROP POLICY IF EXISTS "users_update_self" ON "filoLocal"."users";
CREATE POLICY "users_update_self" ON "filoLocal"."users"
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING ((id = (SELECT auth.uid())))
  WITH CHECK ((id = (SELECT auth.uid())));

-- filoLocal.vehicle_handovers / handovers_insert_own
DROP POLICY IF EXISTS "handovers_insert_own" ON "filoLocal"."vehicle_handovers";
CREATE POLICY "handovers_insert_own" ON "filoLocal"."vehicle_handovers"
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (("filoLocal".is_employee() AND (driver_id = (SELECT auth.uid())) AND (company_id = "filoLocal".current_company_id())));

-- filoLocal.vehicle_handovers / handovers_select
DROP POLICY IF EXISTS "handovers_select" ON "filoLocal"."vehicle_handovers";
CREATE POLICY "handovers_select" ON "filoLocal"."vehicle_handovers"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (("filoLocal".is_employee() AND ((driver_id = (SELECT auth.uid())) OR ((company_id = "filoLocal".current_company_id()) AND "filoLocal".is_manager_or_above()))));

-- public.chat_messages / users see own messages
DROP POLICY IF EXISTS "users see own messages" ON "public"."chat_messages";
CREATE POLICY "users see own messages" ON "public"."chat_messages"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING ((user_id = (SELECT auth.uid())))
  WITH CHECK ((user_id = (SELECT auth.uid())));

-- public.chat_sessions / users see own sessions
DROP POLICY IF EXISTS "users see own sessions" ON "public"."chat_sessions";
CREATE POLICY "users see own sessions" ON "public"."chat_sessions"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING ((user_id = (SELECT auth.uid())))
  WITH CHECK ((user_id = (SELECT auth.uid())));

-- public.customer_notifications / cn_self_select
DROP POLICY IF EXISTS "cn_self_select" ON "public"."customer_notifications";
CREATE POLICY "cn_self_select" ON "public"."customer_notifications"
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((customer_id IN ( SELECT customers.id
   FROM customers
  WHERE (customers.auth_user_id = (SELECT auth.uid())))));

-- public.customer_notifications / cn_self_update
DROP POLICY IF EXISTS "cn_self_update" ON "public"."customer_notifications";
CREATE POLICY "cn_self_update" ON "public"."customer_notifications"
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING ((customer_id IN ( SELECT customers.id
   FROM customers
  WHERE (customers.auth_user_id = (SELECT auth.uid())))));

-- public.customers / customers_self_insert
DROP POLICY IF EXISTS "customers_self_insert" ON "public"."customers";
CREATE POLICY "customers_self_insert" ON "public"."customers"
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK ((auth_user_id = (SELECT auth.uid())));

-- public.customers / customers_self_select
DROP POLICY IF EXISTS "customers_self_select" ON "public"."customers";
CREATE POLICY "customers_self_select" ON "public"."customers"
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((auth_user_id = (SELECT auth.uid())));

-- public.customers / customers_self_update
DROP POLICY IF EXISTS "customers_self_update" ON "public"."customers";
CREATE POLICY "customers_self_update" ON "public"."customers"
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING ((auth_user_id = (SELECT auth.uid())))
  WITH CHECK ((auth_user_id = (SELECT auth.uid())));

-- public.fleets_visibility / fv_owner_all
DROP POLICY IF EXISTS "fv_owner_all" ON "public"."fleets_visibility";
CREATE POLICY "fv_owner_all" ON "public"."fleets_visibility"
  AS PERMISSIVE
  FOR ALL
  TO public
  USING (((organization_id = ( SELECT p.organization_id
   FROM profiles p
  WHERE (p.id = (SELECT auth.uid())))) AND (( SELECT p.role
   FROM profiles p
  WHERE (p.id = (SELECT auth.uid()))) = 'owner'::user_role)))
  WITH CHECK (((organization_id = ( SELECT p.organization_id
   FROM profiles p
  WHERE (p.id = (SELECT auth.uid())))) AND (( SELECT p.role
   FROM profiles p
  WHERE (p.id = (SELECT auth.uid()))) = 'owner'::user_role)));

-- public.invitations / owner_manager_create_invitations
DROP POLICY IF EXISTS "owner_manager_create_invitations" ON "public"."invitations";
CREATE POLICY "owner_manager_create_invitations" ON "public"."invitations"
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (((organization_id = current_user_org_id()) AND (current_user_role() = ANY (ARRAY['owner'::user_role, 'manager'::user_role])) AND (invited_by = (SELECT auth.uid())) AND (role = ANY (ARRAY['manager'::user_role, 'driver'::user_role]))));

-- public.jobs / members_update_jobs
DROP POLICY IF EXISTS "members_update_jobs" ON "public"."jobs";
CREATE POLICY "members_update_jobs" ON "public"."jobs"
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (((organization_id = current_user_org_id()) AND ((current_user_role() = 'owner'::user_role) OR ((current_user_role() = 'manager'::user_role) AND ((driver_id IS NULL) OR (created_by = (SELECT auth.uid())) OR current_user_can_see_user(driver_id))) OR ((current_user_role() = 'driver'::user_role) AND ((driver_id = (SELECT auth.uid())) OR ((status = 'open'::job_status) AND (driver_id IS NULL)))))))
  WITH CHECK (((organization_id = current_user_org_id()) AND ((current_user_role() = 'owner'::user_role) OR ((current_user_role() = 'manager'::user_role) AND ((driver_id IS NULL) OR (created_by = (SELECT auth.uid())) OR current_user_can_see_user(driver_id))) OR ((current_user_role() = 'driver'::user_role) AND (driver_id = (SELECT auth.uid()))))));

-- public.jobs / org_read_jobs
DROP POLICY IF EXISTS "org_read_jobs" ON "public"."jobs";
CREATE POLICY "org_read_jobs" ON "public"."jobs"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (((organization_id = current_user_org_id()) AND ((current_user_role() = 'owner'::user_role) OR ((current_user_role() = 'manager'::user_role) AND ((driver_id IS NULL) OR (created_by = (SELECT auth.uid())) OR current_user_can_see_user(driver_id))) OR ((current_user_role() = 'driver'::user_role) AND ((driver_id = (SELECT auth.uid())) OR ((status = 'open'::job_status) AND (driver_id IS NULL)))))));

-- public.jobs / owner_manager_create_jobs
DROP POLICY IF EXISTS "owner_manager_create_jobs" ON "public"."jobs";
CREATE POLICY "owner_manager_create_jobs" ON "public"."jobs"
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (((organization_id = current_user_org_id()) AND (current_user_role() = ANY (ARRAY['owner'::user_role, 'manager'::user_role])) AND (created_by = (SELECT auth.uid()))));

-- public.maintenance_requests / mreq_create
DROP POLICY IF EXISTS "mreq_create" ON "public"."maintenance_requests";
CREATE POLICY "mreq_create" ON "public"."maintenance_requests"
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (((organization_id = current_user_org_id()) AND (requester_id = (SELECT auth.uid()))));

-- public.notifications / notifications_read_self
DROP POLICY IF EXISTS "notifications_read_self" ON "public"."notifications";
CREATE POLICY "notifications_read_self" ON "public"."notifications"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((recipient_id = (SELECT auth.uid())));

-- public.notifications / notifications_update_self
DROP POLICY IF EXISTS "notifications_update_self" ON "public"."notifications";
CREATE POLICY "notifications_update_self" ON "public"."notifications"
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING ((recipient_id = (SELECT auth.uid())))
  WITH CHECK ((recipient_id = (SELECT auth.uid())));

-- public.organizations / owner_update_org
DROP POLICY IF EXISTS "owner_update_org" ON "public"."organizations";
CREATE POLICY "owner_update_org" ON "public"."organizations"
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING ((owner_id = (SELECT auth.uid())))
  WITH CHECK ((owner_id = (SELECT auth.uid())));

-- public.payments / pay_customer_select
DROP POLICY IF EXISTS "pay_customer_select" ON "public"."payments";
CREATE POLICY "pay_customer_select" ON "public"."payments"
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((ride_request_id IN ( SELECT ride_requests.id
   FROM ride_requests
  WHERE (ride_requests.customer_id IN ( SELECT customers.id
           FROM customers
          WHERE (customers.auth_user_id = (SELECT auth.uid())))))));

-- public.permission_overrides / permission_overrides_read
DROP POLICY IF EXISTS "permission_overrides_read" ON "public"."permission_overrides";
CREATE POLICY "permission_overrides_read" ON "public"."permission_overrides"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (((user_id = (SELECT auth.uid())) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (SELECT auth.uid())) AND (p.organization_id = permission_overrides.organization_id) AND (p.role = 'owner'::user_role))))));

-- public.profiles / update_own_profile
DROP POLICY IF EXISTS "update_own_profile" ON "public"."profiles";
CREATE POLICY "update_own_profile" ON "public"."profiles"
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING ((id = (SELECT auth.uid())))
  WITH CHECK ((id = (SELECT auth.uid())));

-- public.ratings / rt_self_select
DROP POLICY IF EXISTS "rt_self_select" ON "public"."ratings";
CREATE POLICY "rt_self_select" ON "public"."ratings"
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((((rater_type = 'customer'::text) AND (rater_id IN ( SELECT customers.id
   FROM customers
  WHERE (customers.auth_user_id = (SELECT auth.uid()))))) OR ((ratee_type = 'customer'::text) AND (ratee_id IN ( SELECT customers.id
   FROM customers
  WHERE (customers.auth_user_id = (SELECT auth.uid()))))) OR ((rater_type = 'driver'::text) AND (rater_id = (SELECT auth.uid()))) OR ((ratee_type = 'driver'::text) AND (ratee_id = (SELECT auth.uid())))));

-- public.ride_offers / ro_customer_select
DROP POLICY IF EXISTS "ro_customer_select" ON "public"."ride_offers";
CREATE POLICY "ro_customer_select" ON "public"."ride_offers"
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((ride_request_id IN ( SELECT ride_requests.id
   FROM ride_requests
  WHERE (ride_requests.customer_id IN ( SELECT customers.id
           FROM customers
          WHERE (customers.auth_user_id = (SELECT auth.uid())))))));

-- public.ride_offers / ro_driver_select
DROP POLICY IF EXISTS "ro_driver_select" ON "public"."ride_offers";
CREATE POLICY "ro_driver_select" ON "public"."ride_offers"
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((driver_id = (SELECT auth.uid())));

-- public.ride_requests / rr_customer_insert
DROP POLICY IF EXISTS "rr_customer_insert" ON "public"."ride_requests";
CREATE POLICY "rr_customer_insert" ON "public"."ride_requests"
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (((customer_id IN ( SELECT customers.id
   FROM customers
  WHERE (customers.auth_user_id = (SELECT auth.uid())))) AND (status = 'searching'::ride_status)));

-- public.ride_requests / rr_customer_select
DROP POLICY IF EXISTS "rr_customer_select" ON "public"."ride_requests";
CREATE POLICY "rr_customer_select" ON "public"."ride_requests"
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((customer_id IN ( SELECT customers.id
   FROM customers
  WHERE (customers.auth_user_id = (SELECT auth.uid())))));

-- public.ride_requests / rr_customer_update
DROP POLICY IF EXISTS "rr_customer_update" ON "public"."ride_requests";
CREATE POLICY "rr_customer_update" ON "public"."ride_requests"
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING ((customer_id IN ( SELECT customers.id
   FROM customers
  WHERE (customers.auth_user_id = (SELECT auth.uid())))));

-- public.ride_requests / rr_driver_select
DROP POLICY IF EXISTS "rr_driver_select" ON "public"."ride_requests";
CREATE POLICY "rr_driver_select" ON "public"."ride_requests"
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((driver_id = (SELECT auth.uid())));

-- public.ride_requests / rr_org_staff_select
DROP POLICY IF EXISTS "rr_org_staff_select" ON "public"."ride_requests";
CREATE POLICY "rr_org_staff_select" ON "public"."ride_requests"
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (((organization_id = ( SELECT p.organization_id
   FROM profiles p
  WHERE (p.id = (SELECT auth.uid())))) AND ((( SELECT p.role
   FROM profiles p
  WHERE (p.id = (SELECT auth.uid()))) = 'owner'::user_role) OR ((( SELECT p.role
   FROM profiles p
  WHERE (p.id = (SELECT auth.uid()))) = 'manager'::user_role) AND ((driver_id IS NULL) OR current_user_can_see_user(driver_id))))));

-- public.vehicle_assignments / va_insert_self
DROP POLICY IF EXISTS "va_insert_self" ON "public"."vehicle_assignments";
CREATE POLICY "va_insert_self" ON "public"."vehicle_assignments"
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (((organization_id = current_user_org_id()) AND (user_id = (SELECT auth.uid()))));

-- public.vehicle_assignments / va_org_read
DROP POLICY IF EXISTS "va_org_read" ON "public"."vehicle_assignments";
CREATE POLICY "va_org_read" ON "public"."vehicle_assignments"
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (((organization_id = current_user_org_id()) AND ((current_user_role() = 'owner'::user_role) OR ((current_user_role() = 'manager'::user_role) AND current_user_can_see_user(user_id)) OR ((current_user_role() = 'driver'::user_role) AND (user_id = (SELECT auth.uid()))))));

-- public.vehicle_assignments / va_update_self
DROP POLICY IF EXISTS "va_update_self" ON "public"."vehicle_assignments";
CREATE POLICY "va_update_self" ON "public"."vehicle_assignments"
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (((organization_id = current_user_org_id()) AND ((current_user_role() = 'owner'::user_role) OR ((current_user_role() = 'manager'::user_role) AND current_user_can_see_user(user_id)) OR ((current_user_role() = 'driver'::user_role) AND (user_id = (SELECT auth.uid()))))))
  WITH CHECK (((organization_id = current_user_org_id()) AND ((current_user_role() = 'owner'::user_role) OR ((current_user_role() = 'manager'::user_role) AND current_user_can_see_user(user_id)) OR ((current_user_role() = 'driver'::user_role) AND (user_id = (SELECT auth.uid()))))));

-- public.vehicles / org_read_vehicles
DROP POLICY IF EXISTS "org_read_vehicles" ON "public"."vehicles";
CREATE POLICY "org_read_vehicles" ON "public"."vehicles"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (((organization_id = current_user_org_id()) AND ((current_user_role() = 'owner'::user_role) OR ((current_user_role() = 'manager'::user_role) AND ((current_user_id IS NULL) OR current_user_can_see_user(current_user_id))) OR ((current_user_role() = 'driver'::user_role) AND ((current_user_id = (SELECT auth.uid())) OR (current_user_id IS NULL))))));

-- public.vehicles / owner_manager_add_vehicles
DROP POLICY IF EXISTS "owner_manager_add_vehicles" ON "public"."vehicles";
CREATE POLICY "owner_manager_add_vehicles" ON "public"."vehicles"
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (((organization_id = current_user_org_id()) AND (current_user_role() = ANY (ARRAY['owner'::user_role, 'manager'::user_role])) AND (added_by = (SELECT auth.uid()))));

COMMIT;
