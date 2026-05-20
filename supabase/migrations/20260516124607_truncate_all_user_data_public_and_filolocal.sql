-- Full user-data wipe (operator-approved). Two app schemas + auth.users.
-- Schema/RPC/trigger/RLS/enum/index preserved everywhere.
-- System config tables (app_versions, permission_keys, role_default_permissions,
-- fare_config, spatial_ref_sys) NOT touched.

-- Public schema (drivermesh fleet + ride app data)
TRUNCATE TABLE
  public.ratings,
  public.payments,
  public.ride_offers,
  public.ride_requests,
  public.maintenance_requests,
  public.notifications,
  public.customer_notifications,
  public.permission_overrides,
  public.vehicle_assignments,
  public.invitations,
  public.jobs,
  public.vehicles,
  public.fleets_visibility,
  public.customers,
  public.profiles,
  public.organizations
RESTART IDENTITY CASCADE;

-- filoLocal schema (legacy/POC, audit-discovered, user-approved wipe)
TRUNCATE TABLE
  "filoLocal".users,
  "filoLocal".company_members,
  "filoLocal".legal_consents,
  "filoLocal".invitations,
  "filoLocal".vehicle_assignments,
  "filoLocal".vehicle_handovers,
  "filoLocal".jobs,
  "filoLocal".user_notification_prefs,
  "filoLocal".notifications,
  "filoLocal".chat_thread_members,
  "filoLocal".chat_messages,
  "filoLocal".audit_logs,
  "filoLocal".message_receipts,
  "filoLocal".driver_documents,
  "filoLocal".feedback,
  "filoLocal".leave_requests,
  "filoLocal".driver_statuses,
  "filoLocal".companies,
  "filoLocal".shifts,
  "filoLocal".shift_logs,
  "filoLocal".device_tokens,
  "filoLocal".escalations,
  "filoLocal".incidents,
  "filoLocal".garages,
  "filoLocal".vehicles,
  "filoLocal".vehicle_maintenance,
  "filoLocal".chat_threads
RESTART IDENTITY CASCADE;

-- auth.users (now safe — no remaining FK references after both schemas truncated)
DELETE FROM auth.users;;
