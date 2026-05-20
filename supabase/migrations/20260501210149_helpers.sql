create or replace function "filoLocal".tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function "filoLocal".current_company_id()
returns uuid language sql stable security definer
set search_path = public, "filoLocal"
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true)::json ->> 'company_id', ''),
    ''
  )::uuid;
$$;

create or replace function "filoLocal".current_role()
returns "filoLocal".member_role language sql stable security definer
set search_path = public, "filoLocal"
as $$
  select (current_setting('request.jwt.claims', true)::json ->> 'role')::"filoLocal".member_role;
$$;

create or replace function "filoLocal".current_user_type()
returns "filoLocal".user_type language sql stable security definer
set search_path = public, "filoLocal"
as $$
  select coalesce(
    (current_setting('request.jwt.claims', true)::json ->> 'user_type')::"filoLocal".user_type,
    'employee'::"filoLocal".user_type
  );
$$;

create or replace function "filoLocal".is_patron()
returns boolean language sql stable as $$
  select "filoLocal".current_role() = 'patron'::"filoLocal".member_role;
$$;

create or replace function "filoLocal".is_manager_or_above()
returns boolean language sql stable as $$
  select "filoLocal".current_role() in (
    'patron'::"filoLocal".member_role,
    'mudur'::"filoLocal".member_role
  );
$$;

create or replace function "filoLocal".is_employee()
returns boolean language sql stable as $$
  select "filoLocal".current_user_type() = 'employee'::"filoLocal".user_type;
$$;;
