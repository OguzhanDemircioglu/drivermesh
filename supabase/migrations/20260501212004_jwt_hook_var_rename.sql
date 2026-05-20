-- Bug fix: değişken adı `user_id` cm.user_id ile çakışıyordu.
create or replace function "filoLocal".custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable security definer
set search_path = public, "filoLocal"
as $$
declare
  v_user_id uuid := (event ->> 'user_id')::uuid;
  claims jsonb := event -> 'claims';
  v_company_id uuid;
  v_role "filoLocal".member_role;
  v_user_type "filoLocal".user_type;
begin
  select cm.company_id, cm.role
    into v_company_id, v_role
  from "filoLocal".company_members cm
  where cm.user_id = v_user_id
    and cm.is_active
    and cm.deleted_at is null
  order by cm.joined_at desc
  limit 1;

  select u.user_type
    into v_user_type
  from "filoLocal".users u
  where u.id = v_user_id;

  if v_user_type is not null then
    claims := jsonb_set(claims, '{user_type}', to_jsonb(v_user_type::text));
  end if;
  if v_company_id is not null then
    claims := jsonb_set(claims, '{company_id}', to_jsonb(v_company_id::text));
  end if;
  if v_role is not null then
    claims := jsonb_set(claims, '{role}', to_jsonb(v_role::text));
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;;
