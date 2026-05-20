create or replace function public.delete_fleet()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id    uuid := auth.uid();
  caller_role  text;
  caller_org   uuid;
begin
  if caller_id is null then raise exception 'unauthenticated' using errcode = '28000'; end if;
  select role::text, organization_id into caller_role, caller_org
    from public.profiles where id = caller_id;
  if caller_role <> 'owner' then raise exception 'forbidden_only_owner_can_delete' using errcode = '42501'; end if;
  if caller_org is null then raise exception 'no_org' using errcode = '42501'; end if;

  -- Org-scoped temizlik (FK order: child → parent)
  delete from public.notifications where organization_id = caller_org;
  delete from public.permission_overrides where organization_id = caller_org;
  delete from public.invitations where organization_id = caller_org;
  delete from public.jobs where organization_id = caller_org;
  delete from public.vehicles where organization_id = caller_org;

  -- Diğer member'ları organizasyondan ayır (auth.users kalır, profile boş org ile kalır)
  update public.profiles
     set organization_id = null
   where organization_id = caller_org and id <> caller_id;

  -- Owner kendisini de ayır + role'ünü driver'a düşür
  update public.profiles
     set organization_id = null, role = 'driver'
   where id = caller_id;

  -- Son olarak organizasyonu sil
  delete from public.organizations where id = caller_org;
end;
$$;

revoke all on function public.delete_fleet() from public;
grant execute on function public.delete_fleet() to authenticated;;
