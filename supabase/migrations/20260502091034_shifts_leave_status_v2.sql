-- ============================================================================
-- 0018: shifts + shift_logs + leave_requests + driver_statuses (table)
-- Note: tablo adı 'driver_statuses' — enum 'driver_status' ile çakışmasın diye.
-- ============================================================================

create table "filoLocal".shifts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references "filoLocal".companies(id) on delete cascade,
  driver_id uuid not null references "filoLocal".users(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  effective_from date not null default current_date,
  effective_to date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (start_time < end_time)
);
create index idx_shifts_driver on "filoLocal".shifts(driver_id) where deleted_at is null;
create index idx_shifts_company on "filoLocal".shifts(company_id, weekday) where deleted_at is null;
create trigger tg_shifts_updated_at before update on "filoLocal".shifts
  for each row execute function "filoLocal".tg_set_updated_at();

create table "filoLocal".shift_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references "filoLocal".companies(id) on delete cascade,
  driver_id uuid not null references "filoLocal".users(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  break_minutes integer not null default 0 check (break_minutes >= 0),
  total_minutes integer
    generated always as (
      case when ended_at is null then null
        else greatest(0, extract(epoch from (ended_at - started_at))::int / 60 - break_minutes)
      end
    ) stored,
  auto_ended boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_shift_logs_driver on "filoLocal".shift_logs(driver_id, started_at desc);
create unique index idx_shift_logs_active_one
  on "filoLocal".shift_logs(driver_id) where ended_at is null;
create trigger tg_shift_logs_updated_at before update on "filoLocal".shift_logs
  for each row execute function "filoLocal".tg_set_updated_at();

create type "filoLocal".leave_status as enum ('pending','approved','rejected','cancelled');

create table "filoLocal".leave_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references "filoLocal".companies(id) on delete cascade,
  driver_id uuid not null references "filoLocal".users(id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  reason text,
  status "filoLocal".leave_status not null default 'pending',
  decided_by uuid references "filoLocal".users(id),
  decided_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index idx_leave_driver on "filoLocal".leave_requests(driver_id, starts_on desc);
create index idx_leave_company_status on "filoLocal".leave_requests(company_id, status);
create trigger tg_leave_updated_at before update on "filoLocal".leave_requests
  for each row execute function "filoLocal".tg_set_updated_at();

create table "filoLocal".driver_statuses (
  driver_id uuid primary key references "filoLocal".users(id) on delete cascade,
  company_id uuid not null references "filoLocal".companies(id) on delete cascade,
  status "filoLocal".driver_status not null default 'offline',
  last_lat double precision,
  last_lng double precision,
  last_seen_at timestamptz not null default now(),
  active_shift_log_id uuid references "filoLocal".shift_logs(id),
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index idx_driver_status_company on "filoLocal".driver_statuses(company_id, status);
create trigger tg_driver_statuses_updated_at before update on "filoLocal".driver_statuses
  for each row execute function "filoLocal".tg_set_updated_at();

alter table "filoLocal".shifts enable row level security;
alter table "filoLocal".shift_logs enable row level security;
alter table "filoLocal".leave_requests enable row level security;
alter table "filoLocal".driver_statuses enable row level security;

create policy shifts_select on "filoLocal".shifts
  for select to authenticated using (
    "filoLocal".is_employee()
    and company_id = "filoLocal".current_company_id()
    and deleted_at is null
  );
create policy shifts_write on "filoLocal".shifts
  for all to authenticated
  using ("filoLocal".is_manager_or_above() and company_id = "filoLocal".current_company_id())
  with check ("filoLocal".is_manager_or_above() and company_id = "filoLocal".current_company_id());

create policy shift_logs_select on "filoLocal".shift_logs
  for select to authenticated using (
    "filoLocal".is_employee()
    and (driver_id = auth.uid()
         or (company_id = "filoLocal".current_company_id() and "filoLocal".is_manager_or_above()))
  );
create policy shift_logs_insert_own on "filoLocal".shift_logs
  for insert to authenticated with check (
    "filoLocal".is_employee() and driver_id = auth.uid()
    and company_id = "filoLocal".current_company_id()
  );
create policy shift_logs_update_own on "filoLocal".shift_logs
  for update to authenticated
  using (driver_id = auth.uid())
  with check (driver_id = auth.uid());

create policy leave_select on "filoLocal".leave_requests
  for select to authenticated using (
    "filoLocal".is_employee()
    and (driver_id = auth.uid()
         or (company_id = "filoLocal".current_company_id() and "filoLocal".is_manager_or_above()))
  );
create policy leave_insert_own on "filoLocal".leave_requests
  for insert to authenticated with check (
    "filoLocal".is_employee() and driver_id = auth.uid()
    and company_id = "filoLocal".current_company_id() and status = 'pending'
  );
create policy leave_cancel_own on "filoLocal".leave_requests
  for update to authenticated
  using (driver_id = auth.uid() and status = 'pending')
  with check (driver_id = auth.uid() and status in ('pending','cancelled'));
create policy leave_decide_manager on "filoLocal".leave_requests
  for update to authenticated
  using ("filoLocal".is_manager_or_above() and company_id = "filoLocal".current_company_id())
  with check ("filoLocal".is_manager_or_above() and company_id = "filoLocal".current_company_id());

create policy driver_status_select on "filoLocal".driver_statuses
  for select to authenticated using (
    "filoLocal".is_employee() and company_id = "filoLocal".current_company_id()
  );
create policy driver_status_upsert_own on "filoLocal".driver_statuses
  for insert to authenticated with check (
    "filoLocal".is_employee() and driver_id = auth.uid()
    and company_id = "filoLocal".current_company_id()
  );
create policy driver_status_update_own on "filoLocal".driver_statuses
  for update to authenticated
  using (driver_id = auth.uid()
         or ("filoLocal".is_manager_or_above() and company_id = "filoLocal".current_company_id()))
  with check (driver_id = auth.uid()
              or ("filoLocal".is_manager_or_above() and company_id = "filoLocal".current_company_id()));

-- RPC: clock_in / clock_out / decide_leave_request
create or replace function "filoLocal".clock_in()
returns "filoLocal".shift_logs
language plpgsql security definer
set search_path = public, "filoLocal"
as $$
declare
  v_user uuid := auth.uid();
  v_company uuid;
  v_log "filoLocal".shift_logs;
begin
  if v_user is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select cm.company_id into v_company
  from "filoLocal".company_members cm
  where cm.user_id = v_user and cm.is_active and cm.deleted_at is null
  order by cm.joined_at desc limit 1;
  if v_company is null then raise exception 'no_company' using errcode = '42501'; end if;
  if exists(select 1 from "filoLocal".shift_logs where driver_id = v_user and ended_at is null) then
    raise exception 'shift_already_active' using errcode = '23505';
  end if;
  insert into "filoLocal".shift_logs (company_id, driver_id) values (v_company, v_user)
  returning * into v_log;
  insert into "filoLocal".driver_statuses (driver_id, company_id, status, active_shift_log_id, last_seen_at)
    values (v_user, v_company, 'available', v_log.id, now())
  on conflict (driver_id) do update
    set status = 'available', company_id = excluded.company_id,
        active_shift_log_id = excluded.active_shift_log_id, last_seen_at = now();
  return v_log;
end;
$$;

create or replace function "filoLocal".clock_out(p_break_minutes integer default 0, p_notes text default null)
returns "filoLocal".shift_logs
language plpgsql security definer
set search_path = public, "filoLocal"
as $$
declare
  v_user uuid := auth.uid();
  v_log "filoLocal".shift_logs;
begin
  if v_user is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if p_break_minutes < 0 then raise exception 'invalid_break' using errcode = '22023'; end if;
  update "filoLocal".shift_logs
     set ended_at = now(),
         break_minutes = greatest(break_minutes, p_break_minutes),
         notes = coalesce(p_notes, notes)
   where driver_id = v_user and ended_at is null
   returning * into v_log;
  if v_log.id is null then raise exception 'no_active_shift' using errcode = 'P0002'; end if;
  update "filoLocal".driver_statuses
     set status = 'offline', active_shift_log_id = null, last_seen_at = now()
   where driver_id = v_user;
  return v_log;
end;
$$;

create or replace function "filoLocal".decide_leave_request(
  p_request_id uuid,
  p_status "filoLocal".leave_status,
  p_rejection_reason text default null
) returns "filoLocal".leave_requests
language plpgsql security definer
set search_path = public, "filoLocal"
as $$
declare
  v_user uuid := auth.uid();
  v_req "filoLocal".leave_requests;
begin
  if v_user is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if p_status not in ('approved','rejected') then raise exception 'invalid_status' using errcode = '22023'; end if;
  select * into v_req from "filoLocal".leave_requests where id = p_request_id;
  if v_req.id is null then raise exception 'request_not_found' using errcode = 'P0002'; end if;
  if v_req.status <> 'pending' then raise exception 'already_decided' using errcode = '22023'; end if;
  if not exists(
    select 1 from "filoLocal".company_members cm
    where cm.user_id = v_user and cm.company_id = v_req.company_id
      and cm.role in ('patron','mudur') and cm.is_active and cm.deleted_at is null
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update "filoLocal".leave_requests
     set status = p_status, decided_by = v_user, decided_at = now(),
         rejection_reason = case when p_status='rejected' then p_rejection_reason else null end
   where id = p_request_id
   returning * into v_req;
  return v_req;
end;
$$;

revoke execute on function "filoLocal".clock_in() from public;
revoke execute on function "filoLocal".clock_out(integer, text) from public;
revoke execute on function "filoLocal".decide_leave_request(uuid, "filoLocal".leave_status, text) from public;
grant execute on function "filoLocal".clock_in() to authenticated;
grant execute on function "filoLocal".clock_out(integer, text) to authenticated;
grant execute on function "filoLocal".decide_leave_request(uuid, "filoLocal".leave_status, text) to authenticated;;
