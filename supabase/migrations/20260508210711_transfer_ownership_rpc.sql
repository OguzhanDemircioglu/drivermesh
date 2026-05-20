create or replace function public.transfer_ownership(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id    uuid := auth.uid();
  caller_role  text;
  caller_org   uuid;
  target_role  text;
  target_org   uuid;
begin
  if caller_id is null then raise exception 'unauthenticated' using errcode = '28000'; end if;
  select role::text, organization_id into caller_role, caller_org
    from public.profiles where id = caller_id;
  if caller_role <> 'owner' then raise exception 'forbidden_only_owner_can_transfer' using errcode = '42501'; end if;
  if caller_org is null then raise exception 'no_org' using errcode = '42501'; end if;

  select role::text, organization_id into target_role, target_org
    from public.profiles where id = target_user_id;
  if target_org is null or target_org <> caller_org then
    raise exception 'target_not_in_org' using errcode = '22023';
  end if;
  if target_role <> 'manager' then
    raise exception 'target_must_be_manager' using errcode = '22023';
  end if;

  update public.profiles set role = 'owner'   where id = target_user_id;
  update public.profiles set role = 'manager' where id = caller_id;
  update public.organizations set owner_id = target_user_id where id = caller_org;
end;
$$;

revoke all on function public.transfer_ownership(uuid) from public;
grant execute on function public.transfer_ownership(uuid) to authenticated;;
