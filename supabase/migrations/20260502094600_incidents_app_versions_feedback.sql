-- ============================================================================
-- 0021: incidents (panik + olay raporu) + app_versions + feedback
-- ============================================================================

create table "filoLocal".incidents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references "filoLocal".companies(id) on delete cascade,
  reporter_id uuid not null references "filoLocal".users(id) on delete cascade,
  driver_id uuid references "filoLocal".users(id) on delete set null,
  vehicle_id uuid references "filoLocal".vehicles(id) on delete set null,
  job_id uuid references "filoLocal".jobs(id) on delete set null,
  type "filoLocal".incident_type not null,
  severity "filoLocal".incident_severity not null default 'medium',
  description text,
  location_lat double precision,
  location_lng double precision,
  photo_urls text[] not null default '{}',
  photo_public_ids text[] not null default '{}',
  resolved_at timestamptz,
  resolved_by uuid references "filoLocal".users(id),
  resolution_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_incidents_company on "filoLocal".incidents(company_id, created_at desc);
create index idx_incidents_open on "filoLocal".incidents(company_id, severity)
  where resolved_at is null;
create trigger tg_incidents_updated_at before update on "filoLocal".incidents
  for each row execute function "filoLocal".tg_set_updated_at();

alter table "filoLocal".incidents enable row level security;

create policy incidents_select on "filoLocal".incidents
  for select to authenticated using (
    "filoLocal".is_employee()
    and (reporter_id = auth.uid()
         or driver_id = auth.uid()
         or (company_id = "filoLocal".current_company_id() and "filoLocal".is_manager_or_above()))
  );
create policy incidents_insert_self on "filoLocal".incidents
  for insert to authenticated with check (
    "filoLocal".is_employee()
    and reporter_id = auth.uid()
    and company_id = "filoLocal".current_company_id()
  );
create policy incidents_update_manager on "filoLocal".incidents
  for update to authenticated
  using ("filoLocal".is_manager_or_above() and company_id = "filoLocal".current_company_id())
  with check ("filoLocal".is_manager_or_above() and company_id = "filoLocal".current_company_id());

-- app_versions: minimum desteklenen build numarası (zorla güncelleme)
create table "filoLocal".app_versions (
  platform text primary key check (platform in ('ios','android')),
  min_supported_build int not null check (min_supported_build > 0),
  latest_build int not null check (latest_build > 0),
  message text,
  updated_at timestamptz not null default now()
);
alter table "filoLocal".app_versions enable row level security;
create policy app_versions_select_all on "filoLocal".app_versions
  for select to authenticated using (true);

-- feedback (uygulama içi geri bildirim)
create table "filoLocal".feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references "filoLocal".users(id) on delete cascade,
  company_id uuid references "filoLocal".companies(id) on delete cascade,
  type text not null check (type in ('bug','idea','question','other')),
  body text not null check (length(body) > 0),
  screenshot_url text,
  app_version text,
  device_info jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index idx_feedback_user on "filoLocal".feedback(user_id, created_at desc);
alter table "filoLocal".feedback enable row level security;
create policy feedback_self on "filoLocal".feedback
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================================
-- RPC: panic_trigger — bir hareketle olay + bildirimler + audit
-- ============================================================================
create or replace function "filoLocal".trigger_panic(
  p_lat double precision default null,
  p_lng double precision default null,
  p_note text default null
) returns "filoLocal".incidents
language plpgsql security definer
set search_path = public, "filoLocal"
as $$
declare
  v_user uuid := auth.uid();
  v_company uuid;
  v_inc "filoLocal".incidents;
  v_recipient record;
begin
  if v_user is null then raise exception 'unauthorized' using errcode='42501'; end if;

  select cm.company_id into v_company
    from "filoLocal".company_members cm
   where cm.user_id = v_user and cm.is_active and cm.deleted_at is null
   order by cm.joined_at desc limit 1;
  if v_company is null then raise exception 'no_company' using errcode='42501'; end if;

  insert into "filoLocal".incidents (
    company_id, reporter_id, driver_id, type, severity,
    description, location_lat, location_lng
  ) values (
    v_company, v_user, v_user, 'panic', 'critical',
    coalesce(p_note, 'Panik butonu tetiklendi'),
    p_lat, p_lng
  ) returning * into v_inc;

  -- Patron + tüm aktif müdürlere paralel push bildirimi (escalation yok, hepsi aynı anda)
  for v_recipient in
    select cm.user_id from "filoLocal".company_members cm
    where cm.company_id = v_company
      and cm.role in ('patron','mudur')
      and cm.is_active and cm.deleted_at is null
      and cm.user_id <> v_user
  loop
    insert into "filoLocal".notifications (
      company_id, user_id, type, channel, title, body, reference_table, reference_id,
      data
    ) values (
      v_company, v_recipient.user_id, 'panic', 'push',
      'PANİK',
      'Bir çalışan panik butonuna bastı.',
      'incidents', v_inc.id,
      jsonb_build_object('lat', p_lat, 'lng', p_lng)
    );
  end loop;

  insert into "filoLocal".audit_logs (company_id, actor_id, action, target_table, target_id, payload)
    values (v_company, v_user, 'panic_trigger', 'incidents', v_inc.id,
            jsonb_build_object('lat', p_lat, 'lng', p_lng));

  return v_inc;
end;
$$;

revoke execute on function "filoLocal".trigger_panic(double precision, double precision, text) from public;
grant execute on function "filoLocal".trigger_panic(double precision, double precision, text) to authenticated;

-- ============================================================================
-- RPC: hesabımı sil (KVKK)
-- Soft delete: filoLocal.users.deleted_at + auth.users SADECE Edge Function ile
-- silinmeli (service role gerekir). Burada sadece kendi profilimizi soft-delete ederiz.
-- ============================================================================
create or replace function "filoLocal".soft_delete_my_account(p_reason text default null)
returns void
language plpgsql security definer
set search_path = public, "filoLocal"
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'unauthorized' using errcode='42501'; end if;

  update "filoLocal".users set deleted_at = now() where id = v_user;
  update "filoLocal".company_members set deleted_at = now(), is_active = false where user_id = v_user;
  update "filoLocal".device_tokens set is_active = false where user_id = v_user;

  insert into "filoLocal".audit_logs (
    company_id, actor_id, action, target_table, target_id, payload
  )
  select cm.company_id, v_user, 'delete', 'users', v_user,
         jsonb_build_object('reason', p_reason)
    from "filoLocal".company_members cm
   where cm.user_id = v_user
   limit 1;
end;
$$;
revoke execute on function "filoLocal".soft_delete_my_account(text) from public;
grant execute on function "filoLocal".soft_delete_my_account(text) to authenticated;

-- ============================================================================
-- RPC: verimi getir (KVKK export)
-- ============================================================================
create or replace function "filoLocal".export_my_data()
returns jsonb
language plpgsql security definer
set search_path = public, "filoLocal"
as $$
declare
  v_user uuid := auth.uid();
  v_data jsonb;
begin
  if v_user is null then raise exception 'unauthorized' using errcode='42501'; end if;
  select jsonb_build_object(
    'profile', (select to_jsonb(u) from "filoLocal".users u where u.id = v_user),
    'memberships', coalesce((select jsonb_agg(to_jsonb(cm))
                              from "filoLocal".company_members cm where cm.user_id = v_user), '[]'::jsonb),
    'shift_logs', coalesce((select jsonb_agg(to_jsonb(sl))
                            from "filoLocal".shift_logs sl where sl.driver_id = v_user), '[]'::jsonb),
    'leave_requests', coalesce((select jsonb_agg(to_jsonb(lr))
                                from "filoLocal".leave_requests lr where lr.driver_id = v_user), '[]'::jsonb),
    'jobs', coalesce((select jsonb_agg(to_jsonb(j))
                      from "filoLocal".jobs j
                      where j.driver_id = v_user or j.created_by = v_user), '[]'::jsonb),
    'consents', coalesce((select jsonb_agg(to_jsonb(lc))
                          from "filoLocal".legal_consents lc where lc.user_id = v_user), '[]'::jsonb)
  ) into v_data;
  return v_data;
end;
$$;
revoke execute on function "filoLocal".export_my_data() from public;
grant execute on function "filoLocal".export_my_data() to authenticated;

-- Seed: ilk app_versions kayıtları
insert into "filoLocal".app_versions (platform, min_supported_build, latest_build, message)
values
  ('ios', 1, 1, null),
  ('android', 1, 1, null)
on conflict (platform) do nothing;;
