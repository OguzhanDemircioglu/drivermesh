-- ============================================================================
-- 0017: driver_documents + vehicle_handovers
-- ============================================================================

-- ----- driver_documents (ehliyet, sağlık raporu, ...) -----
create table "filoLocal".driver_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references "filoLocal".companies(id) on delete cascade,
  driver_id uuid not null references "filoLocal".users(id) on delete cascade,
  document_type "filoLocal".document_type not null,
  document_url text not null,
  document_public_id text not null,
  verification_status "filoLocal".verification_status not null default 'pending',
  verified_by uuid references "filoLocal".users(id),
  verified_at timestamptz,
  rejection_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index idx_driver_docs_driver on "filoLocal".driver_documents(driver_id) where deleted_at is null;
create index idx_driver_docs_status on "filoLocal".driver_documents(company_id, verification_status) where deleted_at is null;
create trigger tg_driver_docs_updated_at before update on "filoLocal".driver_documents
  for each row execute function "filoLocal".tg_set_updated_at();

-- ----- vehicle_handovers (km + 4 yön foto + onay) -----
create table "filoLocal".vehicle_handovers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references "filoLocal".companies(id) on delete cascade,
  vehicle_id uuid not null references "filoLocal".vehicles(id) on delete cascade,
  driver_id uuid not null references "filoLocal".users(id) on delete cascade,
  type "filoLocal".handover_type not null,    -- pickup | dropoff
  km integer not null check (km >= 0),
  photo_front_url text,
  photo_back_url text,
  photo_left_url text,
  photo_right_url text,
  photo_dashboard_url text,                    -- km göstergesi fotoğrafı
  photo_public_ids text[] not null default '{}',
  damage_notes text,
  driver_signed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index idx_handovers_vehicle on "filoLocal".vehicle_handovers(vehicle_id, created_at desc);
create index idx_handovers_driver on "filoLocal".vehicle_handovers(driver_id, created_at desc);

-- ----- RLS -----
alter table "filoLocal".driver_documents enable row level security;
alter table "filoLocal".vehicle_handovers enable row level security;

-- driver_documents:
--   - Şoför kendi belgelerini görür/yükler
--   - Patron/müdür şirketteki tüm belgeleri görür ve doğrular
create policy driver_docs_select_own on "filoLocal".driver_documents
  for select to authenticated using (
    "filoLocal".is_employee()
    and (driver_id = auth.uid()
         or (company_id = "filoLocal".current_company_id() and "filoLocal".is_manager_or_above()))
    and deleted_at is null
  );

create policy driver_docs_insert_own on "filoLocal".driver_documents
  for insert to authenticated with check (
    "filoLocal".is_employee()
    and driver_id = auth.uid()
    and company_id = "filoLocal".current_company_id()
  );

-- Patron/müdür doğrular (verification_status değiştirir)
create policy driver_docs_update_manager on "filoLocal".driver_documents
  for update to authenticated
  using ("filoLocal".is_manager_or_above() and company_id = "filoLocal".current_company_id())
  with check ("filoLocal".is_manager_or_above() and company_id = "filoLocal".current_company_id());

-- vehicle_handovers:
--   - Şoför kendi handover'ını yapar (insert)
--   - Patron/müdür hepsini görür
create policy handovers_select on "filoLocal".vehicle_handovers
  for select to authenticated using (
    "filoLocal".is_employee()
    and (driver_id = auth.uid()
         or (company_id = "filoLocal".current_company_id() and "filoLocal".is_manager_or_above()))
  );

create policy handovers_insert_own on "filoLocal".vehicle_handovers
  for insert to authenticated with check (
    "filoLocal".is_employee()
    and driver_id = auth.uid()
    and company_id = "filoLocal".current_company_id()
  );

-- ============================================================================
-- RPC: ehliyet doğrulama (patron/müdür)
-- ============================================================================
create or replace function "filoLocal".verify_driver_document(
  p_document_id uuid,
  p_status "filoLocal".verification_status,
  p_rejection_reason text default null
) returns "filoLocal".driver_documents
language plpgsql security definer
set search_path = public, "filoLocal"
as $$
declare
  v_user uuid := auth.uid();
  v_doc "filoLocal".driver_documents;
begin
  if v_user is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if p_status not in ('verified','rejected') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;

  select * into v_doc from "filoLocal".driver_documents where id = p_document_id;
  if v_doc.id is null then
    raise exception 'document_not_found' using errcode = 'P0002';
  end if;

  -- Çağıran kullanıcı bu şirketin patronu/müdürü olmalı
  if not exists (
    select 1 from "filoLocal".company_members cm
    where cm.user_id = v_user
      and cm.company_id = v_doc.company_id
      and cm.role in ('patron','mudur')
      and cm.is_active and cm.deleted_at is null
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update "filoLocal".driver_documents
     set verification_status = p_status,
         verified_by = v_user,
         verified_at = now(),
         rejection_reason = case when p_status = 'rejected' then p_rejection_reason else null end
   where id = p_document_id
   returning * into v_doc;

  return v_doc;
end;
$$;

revoke execute on function "filoLocal".verify_driver_document(
  uuid, "filoLocal".verification_status, text
) from public;
grant execute on function "filoLocal".verify_driver_document(
  uuid, "filoLocal".verification_status, text
) to authenticated;;
