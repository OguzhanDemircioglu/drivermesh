-- ============================================================================
-- Fix: JWT custom claim "role" was conflicting with Supabase reserved
-- PostgREST `role` claim → on every request PostgREST tried `SET ROLE patron`
-- and crashed with: ERRCODE 22023 "role \"patron\" does not exist".
-- We now publish the member role under the `app_role` claim instead.
-- ============================================================================

create or replace function "filoLocal".custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable security definer
set search_path = public, "filoLocal"
as $$
declare
  user_id uuid := (event ->> 'user_id')::uuid;
  claims jsonb := event -> 'claims';
  v_company_id uuid;
  v_role "filoLocal".member_role;
  v_user_type "filoLocal".user_type;
begin
  select cm.company_id, cm.role
    into v_company_id, v_role
  from "filoLocal".company_members cm
  where cm.user_id = custom_access_token_hook.user_id
    and cm.is_active
    and cm.deleted_at is null
  order by cm.joined_at desc
  limit 1;

  select u.user_type
    into v_user_type
  from "filoLocal".users u
  where u.id = custom_access_token_hook.user_id;

  if v_user_type is not null then
    claims := jsonb_set(claims, '{user_type}', to_jsonb(v_user_type::text));
  end if;
  if v_company_id is not null then
    claims := jsonb_set(claims, '{company_id}', to_jsonb(v_company_id::text));
  end if;
  if v_role is not null then
    -- IMPORTANT: do NOT use the `role` claim — Supabase reserves it for the
    -- Postgres role PostgREST switches to (anon / authenticated / service_role).
    claims := jsonb_set(claims, '{app_role}', to_jsonb(v_role::text));
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- Helper: read the same claim
create or replace function "filoLocal".current_role()
returns "filoLocal".member_role language sql stable security definer
set search_path = public, "filoLocal"
as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'app_role', '')::"filoLocal".member_role;
$$;;
