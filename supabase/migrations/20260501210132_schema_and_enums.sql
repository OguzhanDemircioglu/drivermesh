create schema if not exists "filoLocal";
grant usage on schema "filoLocal" to anon, authenticated, service_role;

create type "filoLocal".user_type as enum ('employee', 'customer');

create type "filoLocal".member_role as enum ('patron', 'mudur', 'sofor', 'muhasebe', 'monitor');

create type "filoLocal".company_status as enum ('pending', 'active', 'frozen');

create type "filoLocal".invitation_status as enum ('pending', 'accepted', 'declined', 'expired', 'revoked');

create type "filoLocal".driver_status as enum ('offline', 'available', 'busy', 'on_break', 'on_leave', 'invisible');

create type "filoLocal".vehicle_status as enum ('active', 'in_service', 'idle', 'retired');

create type "filoLocal".job_status as enum ('pending', 'assigned', 'accepted', 'rejected', 'in_progress', 'completed', 'cancelled');

create type "filoLocal".job_creation_type as enum ('manual_dispatch', 'customer_request');

create type "filoLocal".incident_type as enum ('accident', 'breakdown', 'customer_issue', 'panic', 'other');

create type "filoLocal".incident_severity as enum ('low', 'medium', 'high', 'critical');

create type "filoLocal".handover_type as enum ('pickup', 'dropoff');

create type "filoLocal".document_type as enum ('driver_license_front', 'driver_license_back', 'vehicle_insurance', 'vehicle_inspection', 'vehicle_registration', 'driver_health', 'other');

create type "filoLocal".verification_status as enum ('pending', 'verified', 'rejected');

create type "filoLocal".escalation_step as enum ('push', 'telegram', 'fallback_user', 'broadcast');

create type "filoLocal".audit_action as enum ('create', 'update', 'delete', 'role_change', 'login', 'logout', 'invite', 'job_assign', 'job_accept', 'job_reject', 'shift_start', 'shift_end', 'document_upload', 'document_verify', 'panic_trigger');

comment on schema "filoLocal" is 'DriverMesh multi-tenant filo yönetim verisi';;
