-- FK covering indexes
-- Supabase performance advisor: 42 FK kolonunda covering
-- index yok → JOIN/cascade DELETE yavaş. Bu migration her
-- FK için `CREATE INDEX IF NOT EXISTS` ekler.
-- Üretilen: scripts/build_fk_index_migration.py

BEGIN;

-- filoLocal.chat_messages (chat_messages_company_id_fkey) → (company_id)
CREATE INDEX IF NOT EXISTS "ifk_chat_messages_company_id" ON "filoLocal"."chat_messages" ("company_id");

-- filoLocal.chat_messages (chat_messages_reply_to_fkey) → (reply_to)
CREATE INDEX IF NOT EXISTS "ifk_chat_messages_reply_to" ON "filoLocal"."chat_messages" ("reply_to");

-- filoLocal.chat_messages (chat_messages_sender_id_fkey) → (sender_id)
CREATE INDEX IF NOT EXISTS "ifk_chat_messages_sender_id" ON "filoLocal"."chat_messages" ("sender_id");

-- filoLocal.driver_documents (driver_documents_verified_by_fkey) → (verified_by)
CREATE INDEX IF NOT EXISTS "ifk_driver_documents_verified_by" ON "filoLocal"."driver_documents" ("verified_by");

-- filoLocal.driver_statuses (driver_statuses_active_shift_log_id_fkey) → (active_shift_log_id)
CREATE INDEX IF NOT EXISTS "ifk_driver_statuses_active_shift_log_id" ON "filoLocal"."driver_statuses" ("active_shift_log_id");

-- filoLocal.escalations (escalations_trigger_user_id_fkey) → (trigger_user_id)
CREATE INDEX IF NOT EXISTS "ifk_escalations_trigger_user_id" ON "filoLocal"."escalations" ("trigger_user_id");

-- filoLocal.feedback (feedback_company_id_fkey) → (company_id)
CREATE INDEX IF NOT EXISTS "ifk_feedback_company_id" ON "filoLocal"."feedback" ("company_id");

-- filoLocal.incidents (incidents_driver_id_fkey) → (driver_id)
CREATE INDEX IF NOT EXISTS "ifk_incidents_driver_id" ON "filoLocal"."incidents" ("driver_id");

-- filoLocal.incidents (incidents_job_id_fkey) → (job_id)
CREATE INDEX IF NOT EXISTS "ifk_incidents_job_id" ON "filoLocal"."incidents" ("job_id");

-- filoLocal.incidents (incidents_reporter_id_fkey) → (reporter_id)
CREATE INDEX IF NOT EXISTS "ifk_incidents_reporter_id" ON "filoLocal"."incidents" ("reporter_id");

-- filoLocal.incidents (incidents_resolved_by_fkey) → (resolved_by)
CREATE INDEX IF NOT EXISTS "ifk_incidents_resolved_by" ON "filoLocal"."incidents" ("resolved_by");

-- filoLocal.incidents (incidents_vehicle_id_fkey) → (vehicle_id)
CREATE INDEX IF NOT EXISTS "ifk_incidents_vehicle_id" ON "filoLocal"."incidents" ("vehicle_id");

-- filoLocal.invitations (invitations_accepted_by_fkey) → (accepted_by)
CREATE INDEX IF NOT EXISTS "ifk_invitations_accepted_by" ON "filoLocal"."invitations" ("accepted_by");

-- filoLocal.invitations (invitations_invited_by_fkey) → (invited_by)
CREATE INDEX IF NOT EXISTS "ifk_invitations_invited_by" ON "filoLocal"."invitations" ("invited_by");

-- filoLocal.jobs (jobs_created_by_fkey) → (created_by)
CREATE INDEX IF NOT EXISTS "ifk_jobs_created_by" ON "filoLocal"."jobs" ("created_by");

-- filoLocal.jobs (jobs_vehicle_id_fkey) → (vehicle_id)
CREATE INDEX IF NOT EXISTS "ifk_jobs_vehicle_id" ON "filoLocal"."jobs" ("vehicle_id");

-- filoLocal.leave_requests (leave_requests_decided_by_fkey) → (decided_by)
CREATE INDEX IF NOT EXISTS "ifk_leave_requests_decided_by" ON "filoLocal"."leave_requests" ("decided_by");

-- filoLocal.message_receipts (message_receipts_user_id_fkey) → (user_id)
CREATE INDEX IF NOT EXISTS "ifk_message_receipts_user_id" ON "filoLocal"."message_receipts" ("user_id");

-- filoLocal.notifications (notifications_company_id_fkey) → (company_id)
CREATE INDEX IF NOT EXISTS "ifk_notifications_company_id" ON "filoLocal"."notifications" ("company_id");

-- filoLocal.shift_logs (shift_logs_company_id_fkey) → (company_id)
CREATE INDEX IF NOT EXISTS "ifk_shift_logs_company_id" ON "filoLocal"."shift_logs" ("company_id");

-- filoLocal.vehicle_assignments (vehicle_assignments_assigned_by_fkey) → (assigned_by)
CREATE INDEX IF NOT EXISTS "ifk_vehicle_assignments_assigned_by" ON "filoLocal"."vehicle_assignments" ("assigned_by");

-- filoLocal.vehicle_assignments (vehicle_assignments_company_id_fkey) → (company_id)
CREATE INDEX IF NOT EXISTS "ifk_vehicle_assignments_company_id" ON "filoLocal"."vehicle_assignments" ("company_id");

-- public.chat_messages (chat_messages_user_id_fkey) → (user_id)
CREATE INDEX IF NOT EXISTS "ifk_chat_messages_user_id" ON "public"."chat_messages" ("user_id");

-- public.chat_sessions (chat_sessions_organization_id_fkey) → (organization_id)
CREATE INDEX IF NOT EXISTS "ifk_chat_sessions_organization_id" ON "public"."chat_sessions" ("organization_id");

-- public.invitations (invitations_accepted_by_fkey) → (accepted_by)
CREATE INDEX IF NOT EXISTS "ifk_invitations_accepted_by" ON "public"."invitations" ("accepted_by");

-- public.invitations (invitations_invited_by_fkey) → (invited_by)
CREATE INDEX IF NOT EXISTS "ifk_invitations_invited_by" ON "public"."invitations" ("invited_by");

-- public.invitations (invitations_manager_id_fkey) → (manager_id)
CREATE INDEX IF NOT EXISTS "ifk_invitations_manager_id" ON "public"."invitations" ("manager_id");

-- public.jobs (jobs_created_by_fkey) → (created_by)
CREATE INDEX IF NOT EXISTS "ifk_jobs_created_by" ON "public"."jobs" ("created_by");

-- public.jobs (jobs_vehicle_id_fkey) → (vehicle_id)
CREATE INDEX IF NOT EXISTS "ifk_jobs_vehicle_id" ON "public"."jobs" ("vehicle_id");

-- public.maintenance_requests (maintenance_requests_decided_by_fkey) → (decided_by)
CREATE INDEX IF NOT EXISTS "ifk_maintenance_requests_decided_by" ON "public"."maintenance_requests" ("decided_by");

-- public.maintenance_requests (maintenance_requests_vehicle_id_fkey) → (vehicle_id)
CREATE INDEX IF NOT EXISTS "ifk_maintenance_requests_vehicle_id" ON "public"."maintenance_requests" ("vehicle_id");

-- public.notifications (notifications_actor_id_fkey) → (actor_id)
CREATE INDEX IF NOT EXISTS "ifk_notifications_actor_id" ON "public"."notifications" ("actor_id");

-- public.organizations (organizations_owner_id_fkey) → (owner_id)
CREATE INDEX IF NOT EXISTS "ifk_organizations_owner_id" ON "public"."organizations" ("owner_id");

-- public.permission_overrides (permission_overrides_granted_by_fkey) → (granted_by)
CREATE INDEX IF NOT EXISTS "ifk_permission_overrides_granted_by" ON "public"."permission_overrides" ("granted_by");

-- public.permission_overrides (permission_overrides_key_fkey) → (key)
CREATE INDEX IF NOT EXISTS "ifk_permission_overrides_key" ON "public"."permission_overrides" ("key");

-- public.ride_offers (ride_offers_organization_id_fkey) → (organization_id)
CREATE INDEX IF NOT EXISTS "ifk_ride_offers_organization_id" ON "public"."ride_offers" ("organization_id");

-- public.ride_offers (ride_offers_vehicle_id_fkey) → (vehicle_id)
CREATE INDEX IF NOT EXISTS "ifk_ride_offers_vehicle_id" ON "public"."ride_offers" ("vehicle_id");

-- public.ride_requests (ride_requests_vehicle_id_fkey) → (vehicle_id)
CREATE INDEX IF NOT EXISTS "ifk_ride_requests_vehicle_id" ON "public"."ride_requests" ("vehicle_id");

-- public.role_default_permissions (role_default_permissions_key_fkey) → (key)
CREATE INDEX IF NOT EXISTS "ifk_role_default_permissions_key" ON "public"."role_default_permissions" ("key");

-- public.vehicle_assignments (vehicle_assignments_organization_id_fkey) → (organization_id)
CREATE INDEX IF NOT EXISTS "ifk_vehicle_assignments_organization_id" ON "public"."vehicle_assignments" ("organization_id");

-- public.vehicles (vehicles_added_by_fkey) → (added_by)
CREATE INDEX IF NOT EXISTS "ifk_vehicles_added_by" ON "public"."vehicles" ("added_by");

-- public.vehicles (vehicles_maintenance_started_by_fkey) → (maintenance_started_by)
CREATE INDEX IF NOT EXISTS "ifk_vehicles_maintenance_started_by" ON "public"."vehicles" ("maintenance_started_by");

COMMIT;
