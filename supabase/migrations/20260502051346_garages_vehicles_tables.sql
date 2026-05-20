-- ============================================================================
-- 0016: Garages + Vehicles + Vehicle Assignments + Maintenance
-- ============================================================================

-- ----- garages -----
create table "filoLocal".garages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references "filoLocal".companies(id) on delete cascade,
  name text not null,
  address text,
  lat double precision,
  lng double precision,
  capacity integer check (capacity is null or capacity > 0),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index idx_garages_company on "filoLocal".garages(company_id) where deleted_at is null;
create trigger tg_garages_updated_at before update on "filoLocal".garages
  for each row execute function "filoLocal".tg_set_updated_at();

-- ----- vehicles -----
create table "filoLocal".vehicles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references "filoLocal".companies(id) on delete cascade,
  garage_id uuid references "filoLocal".garages(id) on delete set null,
  plate text not null,
  make text,
  model text,
  year integer check (year is null or (year between 1950 and 2100)),
  color text,
  vin text,
  status "filoLocal".vehicle_status not null default 'idle',
  notes text,
  photo_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (company_id, plate) deferrable initially deferred
);
create index idx_vehicles_company on "filoLocal".vehicles(company_id) where deleted_at is null;
create index idx_vehicles_garage on "filoLocal".vehicles(garage_id) where deleted_at is null;
create index idx_vehicles_status on "filoLocal".vehicles(company_id, status) where deleted_at is null;
create trigger tg_vehicles_updated_at before update on "filoLocal".vehicles
  for each row execute function "filoLocal".tg_set_updated_at();

-- ----- vehicle_assignments (şoför ↔ araç) -----
create table "filoLocal".vehicle_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references "filoLocal".companies(id) on delete cascade,
  vehicle_id uuid not null references "filoLocal".vehicles(id) on delete cascade,
  driver_id uuid not null references "filoLocal".users(id) on delete cascade,
  assigned_by uuid references "filoLocal".users(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_assignments_vehicle on "filoLocal".vehicle_assignments(vehicle_id, started_at desc);
create index idx_assignments_driver on "filoLocal".vehicle_assignments(driver_id, started_at desc);
create unique index idx_assignments_active_vehicle
  on "filoLocal".vehicle_assignments(vehicle_id) where ended_at is null;
create unique index idx_assignments_active_driver
  on "filoLocal".vehicle_assignments(driver_id) where ended_at is null;
create trigger tg_assignments_updated_at before update on "filoLocal".vehicle_assignments
  for each row execute function "filoLocal".tg_set_updated_at();

-- ----- vehicle_maintenance (sigorta/muayene/servis kayıtları) -----
create table "filoLocal".vehicle_maintenance (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references "filoLocal".companies(id) on delete cascade,
  vehicle_id uuid not null references "filoLocal".vehicles(id) on delete cascade,
  document_type "filoLocal".document_type not null,
  document_url text,
  document_public_id text,
  issued_at date,
  expires_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index idx_maintenance_vehicle on "filoLocal".vehicle_maintenance(vehicle_id) where deleted_at is null;
create index idx_maintenance_expiry on "filoLocal".vehicle_maintenance(company_id, expires_at) where deleted_at is null;
create trigger tg_maintenance_updated_at before update on "filoLocal".vehicle_maintenance
  for each row execute function "filoLocal".tg_set_updated_at();

-- ----- RLS -----
alter table "filoLocal".garages enable row level security;
alter table "filoLocal".vehicles enable row level security;
alter table "filoLocal".vehicle_assignments enable row level security;
alter table "filoLocal".vehicle_maintenance enable row level security;

-- Şirkete bağlı genel okuma policy'si (4 tablo için ortak)
create policy garages_select on "filoLocal".garages
  for select to authenticated using (
    "filoLocal".is_employee()
    and company_id = "filoLocal".current_company_id()
    and deleted_at is null
  );
create policy vehicles_select on "filoLocal".vehicles
  for select to authenticated using (
    "filoLocal".is_employee()
    and company_id = "filoLocal".current_company_id()
    and deleted_at is null
  );
create policy assignments_select on "filoLocal".vehicle_assignments
  for select to authenticated using (
    "filoLocal".is_employee()
    and company_id = "filoLocal".current_company_id()
  );
create policy maintenance_select on "filoLocal".vehicle_maintenance
  for select to authenticated using (
    "filoLocal".is_employee()
    and company_id = "filoLocal".current_company_id()
    and deleted_at is null
  );

-- Yazma yetkisi: patron veya müdür
create policy garages_write on "filoLocal".garages
  for all to authenticated
  using (
    "filoLocal".is_manager_or_above()
    and company_id = "filoLocal".current_company_id()
  )
  with check (
    "filoLocal".is_manager_or_above()
    and company_id = "filoLocal".current_company_id()
  );
create policy vehicles_write on "filoLocal".vehicles
  for all to authenticated
  using (
    "filoLocal".is_manager_or_above()
    and company_id = "filoLocal".current_company_id()
  )
  with check (
    "filoLocal".is_manager_or_above()
    and company_id = "filoLocal".current_company_id()
  );
create policy assignments_write on "filoLocal".vehicle_assignments
  for all to authenticated
  using (
    "filoLocal".is_manager_or_above()
    and company_id = "filoLocal".current_company_id()
  )
  with check (
    "filoLocal".is_manager_or_above()
    and company_id = "filoLocal".current_company_id()
  );
create policy maintenance_write on "filoLocal".vehicle_maintenance
  for all to authenticated
  using (
    "filoLocal".is_manager_or_above()
    and company_id = "filoLocal".current_company_id()
  )
  with check (
    "filoLocal".is_manager_or_above()
    and company_id = "filoLocal".current_company_id()
  );;
