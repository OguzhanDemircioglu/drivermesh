-- ============================================================================
-- 0019: jobs tablosu + assign/accept/reject/start/complete RPC'leri
-- Pickup→dropoff animasyonu için sadece "son konum" (current_lat/lng) tutulur,
-- polyline/path tarihçesi yok (storage tasarrufu, KVKK).
-- ============================================================================

create table "filoLocal".jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references "filoLocal".companies(id) on delete cascade,
  created_by uuid not null references "filoLocal".users(id),
  driver_id uuid references "filoLocal".users(id) on delete set null,
  vehicle_id uuid references "filoLocal".vehicles(id) on delete set null,

  status "filoLocal".job_status not null default 'pending',
  creation_type "filoLocal".job_creation_type not null default 'manual_dispatch',

  -- v2 köprüsü: müşteri uygulamasından gelen iş için. v1'de hep null.
  customer_id uuid,

  pickup_address text,
  pickup_lat double precision not null,
  pickup_lng double precision not null,
  dropoff_address text,
  dropoff_lat double precision not null,
  dropoff_lng double precision not null,

  -- Anlık konum (10sn throttle ile güncellenir)
  current_lat double precision,
  current_lng double precision,
  current_updated_at timestamptz,

  scheduled_at timestamptz,
  assigned_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,

  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_jobs_company_status on "filoLocal".jobs(company_id, status);
create index idx_jobs_driver_active on "filoLocal".jobs(driver_id, status)
  where status in ('assigned','accepted','in_progress');
create index idx_jobs_pickup_geo on "filoLocal".jobs(pickup_lat, pickup_lng);
create trigger tg_jobs_updated_at before update on "filoLocal".jobs
  for each row execute function "filoLocal".tg_set_updated_at();

alter table "filoLocal".jobs enable row level security;

-- Şoför sadece kendisine atanan veya kendisinin yarattığı işi görür;
-- patron/müdür şirketteki tüm işleri görür.
create policy jobs_select on "filoLocal".jobs
  for select to authenticated using (
    "filoLocal".is_employee()
    and (driver_id = auth.uid()
         or created_by = auth.uid()
         or (company_id = "filoLocal".current_company_id() and "filoLocal".is_manager_or_above()))
  );

-- Yazma → patron/müdür (insert via RPC önerilir, ama UI hızı için doğrudan da serbest)
create policy jobs_insert_manager on "filoLocal".jobs
  for insert to authenticated with check (
    "filoLocal".is_manager_or_above()
    and company_id = "filoLocal".current_company_id()
    and created_by = auth.uid()
  );

-- Şoförün konum push'u kendi işine, patron/müdür her şeyi update edebilir.
create policy jobs_update_driver_or_manager on "filoLocal".jobs
  for update to authenticated
  using (
    (driver_id = auth.uid())
    or ("filoLocal".is_manager_or_above() and company_id = "filoLocal".current_company_id())
  )
  with check (
    (driver_id = auth.uid())
    or ("filoLocal".is_manager_or_above() and company_id = "filoLocal".current_company_id())
  );

-- ============================================================================
-- RPC'ler
-- ============================================================================

-- Patron/müdür: iş ata
create or replace function "filoLocal".assign_job(
  p_job_id uuid,
  p_driver_id uuid,
  p_vehicle_id uuid default null
) returns "filoLocal".jobs
language plpgsql security definer
set search_path = public, "filoLocal"
as $$
declare
  v_user uuid := auth.uid();
  v_job "filoLocal".jobs;
begin
  if v_user is null then raise exception 'unauthorized' using errcode='42501'; end if;

  select * into v_job from "filoLocal".jobs where id = p_job_id;
  if v_job.id is null then raise exception 'job_not_found' using errcode='P0002'; end if;

  if not exists(
    select 1 from "filoLocal".company_members cm
    where cm.user_id = v_user and cm.company_id = v_job.company_id
      and cm.role in ('patron','mudur') and cm.is_active and cm.deleted_at is null
  ) then raise exception 'forbidden' using errcode='42501'; end if;

  if v_job.status not in ('pending') then
    raise exception 'invalid_state' using errcode='22023';
  end if;

  -- Hedef şoför aynı şirketin sürücüsü olmalı
  if not exists(
    select 1 from "filoLocal".company_members cm
    where cm.user_id = p_driver_id and cm.company_id = v_job.company_id
      and cm.role in ('sofor','mudur','patron') and cm.is_active and cm.deleted_at is null
  ) then raise exception 'driver_not_in_company' using errcode='42501'; end if;

  update "filoLocal".jobs
     set driver_id = p_driver_id,
         vehicle_id = coalesce(p_vehicle_id, vehicle_id),
         status = 'assigned',
         assigned_at = now()
   where id = p_job_id
   returning * into v_job;

  return v_job;
end;
$$;

-- Şoför: iş kabul et
create or replace function "filoLocal".accept_job(p_job_id uuid)
returns "filoLocal".jobs
language plpgsql security definer
set search_path = public, "filoLocal"
as $$
declare
  v_user uuid := auth.uid();
  v_job "filoLocal".jobs;
begin
  if v_user is null then raise exception 'unauthorized' using errcode='42501'; end if;
  select * into v_job from "filoLocal".jobs where id = p_job_id;
  if v_job.id is null then raise exception 'job_not_found' using errcode='P0002'; end if;
  if v_job.driver_id <> v_user then raise exception 'forbidden' using errcode='42501'; end if;
  if v_job.status <> 'assigned' then raise exception 'invalid_state' using errcode='22023'; end if;

  update "filoLocal".jobs
     set status = 'accepted', accepted_at = now()
   where id = p_job_id
   returning * into v_job;

  -- Şoför "busy" olur
  insert into "filoLocal".driver_statuses (driver_id, company_id, status, last_seen_at)
    values (v_user, v_job.company_id, 'busy', now())
  on conflict (driver_id) do update
    set status = 'busy', last_seen_at = now();

  return v_job;
end;
$$;

-- Şoför: iş reddet (sebep zorunlu)
create or replace function "filoLocal".reject_job(p_job_id uuid, p_reason text)
returns "filoLocal".jobs
language plpgsql security definer
set search_path = public, "filoLocal"
as $$
declare
  v_user uuid := auth.uid();
  v_job "filoLocal".jobs;
begin
  if v_user is null then raise exception 'unauthorized' using errcode='42501'; end if;
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'reason_required' using errcode='22023';
  end if;
  select * into v_job from "filoLocal".jobs where id = p_job_id;
  if v_job.id is null then raise exception 'job_not_found' using errcode='P0002'; end if;
  if v_job.driver_id <> v_user then raise exception 'forbidden' using errcode='42501'; end if;
  if v_job.status not in ('assigned','accepted') then
    raise exception 'invalid_state' using errcode='22023';
  end if;

  update "filoLocal".jobs
     set status = 'rejected',
         rejected_at = now(),
         rejection_reason = p_reason,
         driver_id = null
   where id = p_job_id
   returning * into v_job;

  return v_job;
end;
$$;

-- Şoför: işe başla (in_progress) — kabul sonrası
create or replace function "filoLocal".start_job(p_job_id uuid)
returns "filoLocal".jobs
language plpgsql security definer
set search_path = public, "filoLocal"
as $$
declare
  v_user uuid := auth.uid();
  v_job "filoLocal".jobs;
begin
  if v_user is null then raise exception 'unauthorized' using errcode='42501'; end if;
  select * into v_job from "filoLocal".jobs where id = p_job_id;
  if v_job.driver_id <> v_user then raise exception 'forbidden' using errcode='42501'; end if;
  if v_job.status <> 'accepted' then raise exception 'invalid_state' using errcode='22023'; end if;

  update "filoLocal".jobs
     set status = 'in_progress', started_at = now()
   where id = p_job_id
   returning * into v_job;
  return v_job;
end;
$$;

-- Şoför: işi tamamla (current_lat/lng temizler)
create or replace function "filoLocal".complete_job(p_job_id uuid)
returns "filoLocal".jobs
language plpgsql security definer
set search_path = public, "filoLocal"
as $$
declare
  v_user uuid := auth.uid();
  v_job "filoLocal".jobs;
begin
  if v_user is null then raise exception 'unauthorized' using errcode='42501'; end if;
  select * into v_job from "filoLocal".jobs where id = p_job_id;
  if v_job.driver_id <> v_user then raise exception 'forbidden' using errcode='42501'; end if;
  if v_job.status <> 'in_progress' then raise exception 'invalid_state' using errcode='22023'; end if;

  update "filoLocal".jobs
     set status = 'completed',
         completed_at = now(),
         current_lat = null,
         current_lng = null,
         current_updated_at = null
   where id = p_job_id
   returning * into v_job;

  -- Şoför tekrar müsait
  update "filoLocal".driver_statuses
     set status = 'available', last_seen_at = now()
   where driver_id = v_user;

  return v_job;
end;
$$;

-- Şoför: konum push (10sn throttle)
create or replace function "filoLocal".push_job_location(
  p_job_id uuid,
  p_lat double precision,
  p_lng double precision
) returns "filoLocal".jobs
language plpgsql security definer
set search_path = public, "filoLocal"
as $$
declare
  v_user uuid := auth.uid();
  v_job "filoLocal".jobs;
begin
  if v_user is null then raise exception 'unauthorized' using errcode='42501'; end if;
  if p_lat is null or p_lng is null then
    raise exception 'invalid_coords' using errcode='22023';
  end if;

  select * into v_job from "filoLocal".jobs where id = p_job_id;
  if v_job.driver_id <> v_user then raise exception 'forbidden' using errcode='42501'; end if;
  if v_job.status not in ('accepted','in_progress') then
    raise exception 'invalid_state' using errcode='22023';
  end if;

  -- 10sn throttle (server-side fair-use)
  if v_job.current_updated_at is not null
     and v_job.current_updated_at > now() - interval '10 seconds' then
    return v_job;
  end if;

  update "filoLocal".jobs
     set current_lat = p_lat,
         current_lng = p_lng,
         current_updated_at = now()
   where id = p_job_id
   returning * into v_job;

  -- Şoförün son konumunu da güncelle
  update "filoLocal".driver_statuses
     set last_lat = p_lat, last_lng = p_lng, last_seen_at = now()
   where driver_id = v_user;

  return v_job;
end;
$$;

revoke execute on function "filoLocal".assign_job(uuid, uuid, uuid) from public;
revoke execute on function "filoLocal".accept_job(uuid) from public;
revoke execute on function "filoLocal".reject_job(uuid, text) from public;
revoke execute on function "filoLocal".start_job(uuid) from public;
revoke execute on function "filoLocal".complete_job(uuid) from public;
revoke execute on function "filoLocal".push_job_location(uuid, double precision, double precision) from public;

grant execute on function "filoLocal".assign_job(uuid, uuid, uuid) to authenticated;
grant execute on function "filoLocal".accept_job(uuid) to authenticated;
grant execute on function "filoLocal".reject_job(uuid, text) to authenticated;
grant execute on function "filoLocal".start_job(uuid) to authenticated;
grant execute on function "filoLocal".complete_job(uuid) to authenticated;
grant execute on function "filoLocal".push_job_location(uuid, double precision, double precision) to authenticated;;
