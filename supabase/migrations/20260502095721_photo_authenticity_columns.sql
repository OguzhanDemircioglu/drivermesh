-- ============================================================================
-- 0022: AI foto authenticity check için kolon eklemeleri (3 tablo)
-- - vehicle_handovers, incidents, driver_documents'a:
--   suspected_ai (bool), ai_score (numeric 0..1), exif_status enum
-- ============================================================================

create type "filoLocal".exif_status as enum ('valid','missing','suspicious');

alter table "filoLocal".vehicle_handovers
  add column suspected_ai boolean not null default false,
  add column ai_score numeric(4,3) check (ai_score is null or (ai_score >= 0 and ai_score <= 1)),
  add column exif_status "filoLocal".exif_status,
  add column authenticity_checked_at timestamptz,
  add column authenticity_metadata jsonb not null default '{}'::jsonb;

alter table "filoLocal".incidents
  add column suspected_ai boolean not null default false,
  add column ai_score numeric(4,3) check (ai_score is null or (ai_score >= 0 and ai_score <= 1)),
  add column exif_status "filoLocal".exif_status,
  add column authenticity_checked_at timestamptz,
  add column authenticity_metadata jsonb not null default '{}'::jsonb;

alter table "filoLocal".driver_documents
  add column suspected_ai boolean not null default false,
  add column ai_score numeric(4,3) check (ai_score is null or (ai_score >= 0 and ai_score <= 1)),
  add column exif_status "filoLocal".exif_status,
  add column authenticity_checked_at timestamptz,
  add column authenticity_metadata jsonb not null default '{}'::jsonb;

create index idx_handovers_suspected on "filoLocal".vehicle_handovers(company_id) where suspected_ai;
create index idx_incidents_suspected on "filoLocal".incidents(company_id) where suspected_ai;
create index idx_docs_suspected on "filoLocal".driver_documents(company_id) where suspected_ai;;
