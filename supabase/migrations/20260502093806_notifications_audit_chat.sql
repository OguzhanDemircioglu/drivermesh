-- ============================================================================
-- 0020: device_tokens + notifications + escalations + audit_logs +
--       user_notification_prefs + chat_threads + chat_messages + message_receipts
-- ============================================================================

create type "filoLocal".notification_type as enum (
  'job_assigned','job_accepted','job_rejected','job_started','job_completed',
  'shift_max_warning','break_due','leave_decision','document_verification',
  'invitation','panic','maintenance_due','company_status_change','generic'
);

create type "filoLocal".notification_channel as enum ('push','telegram','in_app','email');

create type "filoLocal".notification_status as enum (
  'queued','sent','delivered','read','failed'
);

-- ----- device_tokens ---------------------------------------------------------
create table "filoLocal".device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references "filoLocal".users(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios','android','web')),
  app_version text,
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (token)
);
create index idx_device_tokens_user on "filoLocal".device_tokens(user_id) where is_active;

alter table "filoLocal".device_tokens enable row level security;
create policy device_tokens_self on "filoLocal".device_tokens
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ----- user_notification_prefs (multi-device sync) ---------------------------
create table "filoLocal".user_notification_prefs (
  user_id uuid primary key references "filoLocal".users(id) on delete cascade,
  push_enabled boolean not null default true,
  telegram_enabled boolean not null default false,
  telegram_chat_id text,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default true,
  muted_until timestamptz,
  category_overrides jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger tg_unp_updated_at before update on "filoLocal".user_notification_prefs
  for each row execute function "filoLocal".tg_set_updated_at();

alter table "filoLocal".user_notification_prefs enable row level security;
create policy unp_self on "filoLocal".user_notification_prefs
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ----- notifications ---------------------------------------------------------
create table "filoLocal".notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references "filoLocal".companies(id) on delete cascade,
  user_id uuid not null references "filoLocal".users(id) on delete cascade,
  type "filoLocal".notification_type not null,
  channel "filoLocal".notification_channel not null,
  status "filoLocal".notification_status not null default 'queued',
  title text not null,
  body text,
  data jsonb not null default '{}'::jsonb,
  reference_table text,
  reference_id uuid,
  delivered_at timestamptz,
  read_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_notif_user_unread on "filoLocal".notifications(user_id, created_at desc)
  where read_at is null;
create index idx_notif_status on "filoLocal".notifications(status, created_at)
  where status in ('queued','sent');
create trigger tg_notif_updated_at before update on "filoLocal".notifications
  for each row execute function "filoLocal".tg_set_updated_at();

alter table "filoLocal".notifications enable row level security;
create policy notif_select_self on "filoLocal".notifications
  for select to authenticated using (user_id = auth.uid());
create policy notif_update_self on "filoLocal".notifications
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ----- escalations -----------------------------------------------------------
create table "filoLocal".escalations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references "filoLocal".companies(id) on delete cascade,
  trigger_user_id uuid references "filoLocal".users(id),
  reference_table text,
  reference_id uuid,
  type "filoLocal".notification_type not null,
  current_step "filoLocal".escalation_step not null default 'push',
  step_history jsonb not null default '[]'::jsonb,
  resolved_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_escalations_open on "filoLocal".escalations(company_id, created_at)
  where resolved_at is null;
create trigger tg_escalations_updated_at before update on "filoLocal".escalations
  for each row execute function "filoLocal".tg_set_updated_at();

alter table "filoLocal".escalations enable row level security;
create policy escalations_select on "filoLocal".escalations
  for select to authenticated using (
    "filoLocal".is_employee()
    and company_id = "filoLocal".current_company_id()
  );

-- ----- audit_logs ------------------------------------------------------------
create table "filoLocal".audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references "filoLocal".companies(id) on delete cascade,
  actor_id uuid references "filoLocal".users(id),
  action "filoLocal".audit_action not null,
  target_table text,
  target_id uuid,
  payload jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);
create index idx_audit_company_time on "filoLocal".audit_logs(company_id, created_at desc);
create index idx_audit_actor on "filoLocal".audit_logs(actor_id, created_at desc);

alter table "filoLocal".audit_logs enable row level security;
-- Sadece patron şirketin tüm audit'ini görür; müdür kendi yarattıklarını görür
create policy audit_select_patron on "filoLocal".audit_logs
  for select to authenticated using (
    "filoLocal".is_patron()
    and company_id = "filoLocal".current_company_id()
  );
create policy audit_select_actor on "filoLocal".audit_logs
  for select to authenticated using (actor_id = auth.uid());

-- ----- chat_threads + chat_messages + message_receipts -----------------------
create type "filoLocal".thread_kind as enum ('group','direct');

create table "filoLocal".chat_threads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references "filoLocal".companies(id) on delete cascade,
  kind "filoLocal".thread_kind not null,
  title text,                    -- group için ad; direct için null
  is_company_default boolean not null default false,  -- her şirketin tek "company group" thread'i
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index idx_thread_company_default on "filoLocal".chat_threads(company_id)
  where is_company_default;
create trigger tg_thread_updated_at before update on "filoLocal".chat_threads
  for each row execute function "filoLocal".tg_set_updated_at();

create table "filoLocal".chat_thread_members (
  thread_id uuid not null references "filoLocal".chat_threads(id) on delete cascade,
  user_id uuid not null references "filoLocal".users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (thread_id, user_id)
);
create index idx_thread_members_user on "filoLocal".chat_thread_members(user_id);

create table "filoLocal".chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references "filoLocal".chat_threads(id) on delete cascade,
  company_id uuid not null references "filoLocal".companies(id) on delete cascade,
  sender_id uuid not null references "filoLocal".users(id) on delete cascade,
  body text not null check (length(body) > 0),
  attachments jsonb not null default '[]'::jsonb,
  reply_to uuid references "filoLocal".chat_messages(id) on delete set null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
create index idx_chat_messages_thread on "filoLocal".chat_messages(thread_id, created_at desc)
  where deleted_at is null;

create table "filoLocal".message_receipts (
  message_id uuid not null references "filoLocal".chat_messages(id) on delete cascade,
  user_id uuid not null references "filoLocal".users(id) on delete cascade,
  delivered_at timestamptz,
  read_at timestamptz,
  primary key (message_id, user_id)
);

-- RLS
alter table "filoLocal".chat_threads enable row level security;
alter table "filoLocal".chat_thread_members enable row level security;
alter table "filoLocal".chat_messages enable row level security;
alter table "filoLocal".message_receipts enable row level security;

-- thread: üyesi olduğun veya şirketinin default group thread'i
create policy threads_select on "filoLocal".chat_threads
  for select to authenticated using (
    "filoLocal".is_employee()
    and company_id = "filoLocal".current_company_id()
    and (
      is_company_default
      or exists (
        select 1 from "filoLocal".chat_thread_members tm
        where tm.thread_id = chat_threads.id and tm.user_id = auth.uid()
      )
    )
  );
create policy threads_insert_manager on "filoLocal".chat_threads
  for insert to authenticated with check (
    "filoLocal".is_manager_or_above()
    and company_id = "filoLocal".current_company_id()
  );

-- thread_members: kendi üyeliklerini görür; manager yönetir
create policy thread_members_self_select on "filoLocal".chat_thread_members
  for select to authenticated using (user_id = auth.uid()
    or exists (
      select 1 from "filoLocal".chat_threads th
      where th.id = chat_thread_members.thread_id
        and th.company_id = "filoLocal".current_company_id()
        and "filoLocal".is_manager_or_above()
    ));
create policy thread_members_manage on "filoLocal".chat_thread_members
  for all to authenticated
  using (
    exists (
      select 1 from "filoLocal".chat_threads th
      where th.id = chat_thread_members.thread_id
        and th.company_id = "filoLocal".current_company_id()
        and "filoLocal".is_manager_or_above()
    )
  )
  with check (
    exists (
      select 1 from "filoLocal".chat_threads th
      where th.id = chat_thread_members.thread_id
        and th.company_id = "filoLocal".current_company_id()
        and "filoLocal".is_manager_or_above()
    )
  );
create policy thread_members_update_self on "filoLocal".chat_thread_members
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- messages: thread üyesi okur; sadece kendi mesajını yazar
create policy chat_msg_select on "filoLocal".chat_messages
  for select to authenticated using (
    "filoLocal".is_employee()
    and company_id = "filoLocal".current_company_id()
    and deleted_at is null
    and (
      exists (
        select 1 from "filoLocal".chat_thread_members tm
        where tm.thread_id = chat_messages.thread_id and tm.user_id = auth.uid()
      )
      or exists (
        select 1 from "filoLocal".chat_threads th
        where th.id = chat_messages.thread_id and th.is_company_default
      )
    )
  );
create policy chat_msg_insert_self on "filoLocal".chat_messages
  for insert to authenticated with check (
    "filoLocal".is_employee()
    and sender_id = auth.uid()
    and company_id = "filoLocal".current_company_id()
  );
create policy chat_msg_soft_delete_self on "filoLocal".chat_messages
  for update to authenticated
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

create policy receipts_select_self on "filoLocal".message_receipts
  for select to authenticated using (user_id = auth.uid());
create policy receipts_upsert_self on "filoLocal".message_receipts
  for insert to authenticated with check (user_id = auth.uid());
create policy receipts_update_self on "filoLocal".message_receipts
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================================
-- RPC'ler
-- ============================================================================

-- Yeni şirket aktive edilince çağırılabilir; şirketin tüm aktif üyelerini içeren
-- "company default" thread'i oluşturur (idempotent).
create or replace function "filoLocal".ensure_company_thread(p_company_id uuid)
returns "filoLocal".chat_threads
language plpgsql security definer
set search_path = public, "filoLocal"
as $$
declare v_thread "filoLocal".chat_threads;
begin
  if not exists(
    select 1 from "filoLocal".company_members cm
    where cm.user_id = auth.uid() and cm.company_id = p_company_id
      and cm.is_active and cm.deleted_at is null
  ) then raise exception 'forbidden' using errcode='42501'; end if;

  select * into v_thread from "filoLocal".chat_threads
   where company_id = p_company_id and is_company_default;
  if v_thread.id is null then
    insert into "filoLocal".chat_threads (company_id, kind, title, is_company_default)
    values (p_company_id, 'group', 'Şirket Geneli', true)
    returning * into v_thread;
  end if;

  -- Tüm aktif üyeleri thread'e ekle
  insert into "filoLocal".chat_thread_members (thread_id, user_id)
    select v_thread.id, cm.user_id
      from "filoLocal".company_members cm
      where cm.company_id = p_company_id and cm.is_active and cm.deleted_at is null
    on conflict do nothing;

  return v_thread;
end;
$$;

-- Mesaj gönder + receipt satırlarını üyeler için oluştur (delivered=null)
create or replace function "filoLocal".send_chat_message(
  p_thread_id uuid,
  p_body text,
  p_reply_to uuid default null
) returns "filoLocal".chat_messages
language plpgsql security definer
set search_path = public, "filoLocal"
as $$
declare
  v_user uuid := auth.uid();
  v_company uuid;
  v_msg "filoLocal".chat_messages;
begin
  if v_user is null then raise exception 'unauthorized' using errcode='42501'; end if;
  if p_body is null or length(trim(p_body)) = 0 then
    raise exception 'empty_body' using errcode='22023';
  end if;

  select th.company_id into v_company
    from "filoLocal".chat_threads th
   where th.id = p_thread_id;
  if v_company is null then raise exception 'thread_not_found' using errcode='P0002'; end if;

  if not exists (
    select 1 from "filoLocal".company_members cm
    where cm.user_id = v_user and cm.company_id = v_company
      and cm.is_active and cm.deleted_at is null
  ) then raise exception 'not_in_company' using errcode='42501'; end if;

  insert into "filoLocal".chat_messages (thread_id, company_id, sender_id, body, reply_to)
    values (p_thread_id, v_company, v_user, p_body, p_reply_to)
  returning * into v_msg;

  -- Üyeler için receipt satırı (gönderici hariç)
  insert into "filoLocal".message_receipts (message_id, user_id)
    select v_msg.id, tm.user_id
      from "filoLocal".chat_thread_members tm
     where tm.thread_id = p_thread_id and tm.user_id <> v_user
  on conflict do nothing;

  return v_msg;
end;
$$;

create or replace function "filoLocal".mark_message_read(p_message_id uuid)
returns void language plpgsql security definer
set search_path = public, "filoLocal"
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then return; end if;
  insert into "filoLocal".message_receipts (message_id, user_id, delivered_at, read_at)
    values (p_message_id, v_user, now(), now())
  on conflict (message_id, user_id) do update
    set delivered_at = coalesce(message_receipts.delivered_at, now()),
        read_at = coalesce(message_receipts.read_at, now());
end;
$$;

revoke execute on function "filoLocal".ensure_company_thread(uuid) from public;
revoke execute on function "filoLocal".send_chat_message(uuid, text, uuid) from public;
revoke execute on function "filoLocal".mark_message_read(uuid) from public;
grant execute on function "filoLocal".ensure_company_thread(uuid) to authenticated;
grant execute on function "filoLocal".send_chat_message(uuid, text, uuid) to authenticated;
grant execute on function "filoLocal".mark_message_read(uuid) to authenticated;;
