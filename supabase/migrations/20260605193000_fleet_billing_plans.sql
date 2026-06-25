-- Fleet abonelik / ücretlendirme katmanı (Free / Pro / Pro+)
--
-- Model:
--   free      → en fazla 3 araç
--   pro       → en fazla 10 araç   (yurt içi 1000 TL/ay)
--   pro_plus  → sınırsız araç      (yurt içi 2000 TL/ay)
--
-- Plan ORGANIZASYON düzeyindedir. Araç limiti SUNUCU TARAFINDA (trigger ile)
-- zorlanır — client kontrolü tek başına yeterli değildir (bypass edilebilir).
--
-- Satın alma WEB tarafında yapılır (PayTR + Google Pay + Nilvera fatura;
-- Faz 2 yurt dışı = Paddle). Uygulama yalnızca planı/yetkiyi OKUR; app içinde
-- ödeme alınmaz (Google Play Billing politikasına uyum). Bu yüzden plan
-- değişimi YALNIZCA service_role (ödeme edge function / webhook) ile yapılır;
-- normal kullanıcı kendi planını yükseltemez.

-- 1) Plan enum -------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'fleet_plan') then
    create type public.fleet_plan as enum ('free', 'pro', 'pro_plus');
  end if;
end $$;

-- 2) organizations: plan + abonelik kolonları ------------------------------
alter table public.organizations
  add column if not exists plan              public.fleet_plan not null default 'free',
  add column if not exists plan_status       text not null default 'active',  -- active | past_due | canceled
  add column if not exists plan_provider     text,                            -- sandbox | paytr | paddle
  add column if not exists plan_external_ref text,                            -- gateway abonelik/ödeme id
  add column if not exists plan_renews_at    timestamptz,                     -- dönem bitişi (aylık)
  add column if not exists plan_updated_at   timestamptz not null default now();

-- 3) Plan başına araç limiti (null = sınırsız) -----------------------------
create or replace function public.fleet_plan_vehicle_limit(p_plan public.fleet_plan)
returns integer
language sql
immutable
set search_path = public
as $$
  select case p_plan
    when 'free'     then 3
    when 'pro'      then 10
    when 'pro_plus' then null   -- sınırsız
  end;
$$;

revoke all on function public.fleet_plan_vehicle_limit(public.fleet_plan) from public;
-- (yalnızca security-definer fonksiyonlar/trigger içinden çağrılır; doğrudan grant yok)

-- 4) Araç ekleme limiti — SUNUCU GARANTİSİ (BEFORE INSERT trigger) ---------
create or replace function public.enforce_vehicle_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan  public.fleet_plan;
  v_limit integer;
  v_count integer;
begin
  select plan into v_plan from public.organizations where id = NEW.organization_id;
  if v_plan is null then v_plan := 'free'; end if;

  v_limit := public.fleet_plan_vehicle_limit(v_plan);
  if v_limit is null then
    return NEW;  -- pro_plus: sınırsız
  end if;

  select count(*) into v_count
    from public.vehicles
   where organization_id = NEW.organization_id;

  if v_count >= v_limit then
    raise exception 'vehicle_limit_reached'
      using errcode = 'check_violation',
            detail  = format('plan=%s limit=%s count=%s', v_plan, v_limit, v_count),
            hint    = 'Daha fazla araç için planı yükseltin (Pro / Pro+).';
  end if;

  return NEW;
end;
$$;

drop trigger if exists vehicles_enforce_plan_limit on public.vehicles;
create trigger vehicles_enforce_plan_limit
  before insert on public.vehicles
  for each row execute function public.enforce_vehicle_plan_limit();

-- 5) Abonelik / ödeme / fatura olay geçmişi --------------------------------
create table if not exists public.fleet_subscription_events (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  plan             public.fleet_plan not null,
  action           text not null,                  -- upgrade | downgrade | renew | cancel | payment | invoice
  provider         text,                           -- sandbox | paytr | paddle
  provider_ref     text,                           -- gateway ödeme/abonelik id
  amount           numeric,
  currency         text default 'TRY',
  invoice_provider text,                           -- nilvera | ...
  invoice_ref      text,
  status           text not null default 'pending',-- pending | success | failed
  payload          jsonb,
  created_by       uuid,
  created_at       timestamptz not null default now()
);

create index if not exists idx_fleet_sub_events_org
  on public.fleet_subscription_events(organization_id, created_at desc);

alter table public.fleet_subscription_events enable row level security;

-- Org üyeleri kendi org'larının abonelik geçmişini görebilir.
-- Yazma politikası yok → INSERT/UPDATE yalnızca service_role (RLS bypass) ile.
drop policy if exists fleet_sub_events_select on public.fleet_subscription_events;
create policy fleet_sub_events_select on public.fleet_subscription_events
  for select to authenticated
  using (
    organization_id = (select organization_id from public.profiles where id = auth.uid())
  );

-- 6) App için plan durumu: mevcut plan + kullanım + limit -------------------
create or replace function public.fleet_plan_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  v_org     uuid;
  v_plan    public.fleet_plan;
  v_status  text;
  v_renews  timestamptz;
  v_limit   integer;
  v_count   integer;
begin
  if caller_id is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;

  select organization_id into v_org from public.profiles where id = caller_id;
  if v_org is null then
    return jsonb_build_object(
      'plan', 'free', 'status', 'active', 'vehicle_count', 0,
      'limit', 3, 'can_add', false, 'no_org', true
    );
  end if;

  select plan, plan_status, plan_renews_at
    into v_plan, v_status, v_renews
    from public.organizations where id = v_org;

  v_limit := public.fleet_plan_vehicle_limit(v_plan);

  select count(*) into v_count
    from public.vehicles where organization_id = v_org;

  return jsonb_build_object(
    'plan',          v_plan,
    'status',        v_status,
    'renews_at',     v_renews,
    'vehicle_count', v_count,
    'limit',         v_limit,                              -- null = sınırsız
    'can_add',       (v_limit is null or v_count < v_limit)
  );
end;
$$;

revoke all on function public.fleet_plan_status() from public;
grant execute on function public.fleet_plan_status() to authenticated;
