create table "filoLocal".companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tax_no text,
  phone text,
  email text,
  status "filoLocal".company_status not null default 'pending',
  owner_id uuid not null,
  logo_url text,
  trial_started_at timestamptz,
  customer_portal_enabled boolean not null default false,
  customer_portal_started_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_companies_owner on "filoLocal".companies(owner_id);
create index idx_companies_status on "filoLocal".companies(status) where deleted_at is null;

create trigger tg_companies_updated_at
  before update on "filoLocal".companies
  for each row execute function "filoLocal".tg_set_updated_at();

create table "filoLocal".users (
  id uuid primary key references auth.users(id) on delete cascade,
  user_type "filoLocal".user_type not null default 'employee',
  full_name text not null,
  phone text,
  email text,
  avatar_url text,
  preferred_language text default 'tr',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_users_phone on "filoLocal".users(phone) where deleted_at is null;
create index idx_users_email on "filoLocal".users(email) where deleted_at is null;
create index idx_users_type on "filoLocal".users(user_type);

create trigger tg_users_updated_at
  before update on "filoLocal".users
  for each row execute function "filoLocal".tg_set_updated_at();

create table "filoLocal".company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references "filoLocal".companies(id) on delete cascade,
  user_id uuid not null references "filoLocal".users(id) on delete cascade,
  role "filoLocal".member_role not null,
  is_active boolean not null default true,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (company_id, user_id)
);

create index idx_members_company on "filoLocal".company_members(company_id) where deleted_at is null;
create index idx_members_user on "filoLocal".company_members(user_id) where deleted_at is null;
create index idx_members_role on "filoLocal".company_members(company_id, role) where is_active and deleted_at is null;

create trigger tg_members_updated_at
  before update on "filoLocal".company_members
  for each row execute function "filoLocal".tg_set_updated_at();

create table "filoLocal".invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references "filoLocal".companies(id) on delete cascade,
  invited_by uuid not null references "filoLocal".users(id),
  target_phone text,
  target_email text,
  intended_role "filoLocal".member_role not null,
  token text not null unique,
  short_code text not null,
  status "filoLocal".invitation_status not null default 'pending',
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references "filoLocal".users(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (target_phone is not null or target_email is not null)
);

create index idx_invitations_company on "filoLocal".invitations(company_id);
create index idx_invitations_token on "filoLocal".invitations(token);
create index idx_invitations_short on "filoLocal".invitations(short_code);
create index idx_invitations_status on "filoLocal".invitations(status, expires_at);

create trigger tg_invitations_updated_at
  before update on "filoLocal".invitations
  for each row execute function "filoLocal".tg_set_updated_at();

create table "filoLocal".legal_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references "filoLocal".users(id) on delete cascade,
  document_type text not null,
  document_version text not null,
  accepted_at timestamptz not null default now(),
  ip_address inet,
  user_agent text,
  unique (user_id, document_type, document_version)
);

create index idx_consents_user on "filoLocal".legal_consents(user_id);

alter table "filoLocal".companies
  add constraint companies_owner_fk foreign key (owner_id)
  references "filoLocal".users(id) deferrable initially deferred;;
