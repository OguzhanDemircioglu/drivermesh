-- ============================================================================
-- Davet sistemi RPC'leri (mobile bunları supabase.rpc('...') ile çağırır)
-- ============================================================================

-- 1) Patron / müdür yeni davet oluşturur. Token + short_code üretir.
create or replace function "filoLocal".create_invitation(
  p_company_id uuid,
  p_intended_role "filoLocal".member_role,
  p_target_email text default null,
  p_target_phone text default null
) returns "filoLocal".invitations
language plpgsql security definer
set search_path = public, "filoLocal"
as $$
declare
  v_invited_by uuid := auth.uid();
  v_token text;
  v_short text;
  v_inv "filoLocal".invitations;
  v_can_invite boolean;
begin
  if v_invited_by is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  -- Sadece patron veya müdür davet edebilir, yalnızca kendi şirketleri için
  select exists (
    select 1 from "filoLocal".company_members cm
    where cm.user_id = v_invited_by
      and cm.company_id = p_company_id
      and cm.role in ('patron', 'mudur')
      and cm.is_active and cm.deleted_at is null
  ) into v_can_invite;

  if not v_can_invite then
    raise exception 'forbidden: only patron/mudur can invite' using errcode = '42501';
  end if;

  -- Patron rolü davet etmeye sadece patron yetkili
  if p_intended_role = 'patron'::"filoLocal".member_role then
    if not exists (
      select 1 from "filoLocal".company_members cm
      where cm.user_id = v_invited_by and cm.company_id = p_company_id
        and cm.role = 'patron' and cm.is_active and cm.deleted_at is null
    ) then
      raise exception 'forbidden: only patron can invite patron' using errcode = '42501';
    end if;
  end if;

  if p_target_email is null and p_target_phone is null then
    raise exception 'target_email or target_phone required' using errcode = '22023';
  end if;

  -- 32 byte hex token (64 char) + 8 char insan-okur kod
  v_token := encode(gen_random_bytes(32), 'hex');
  v_short := upper(substring(replace(encode(gen_random_bytes(6), 'base64'), '/', '')
                              from 1 for 8));

  insert into "filoLocal".invitations
    (company_id, invited_by, target_email, target_phone, intended_role, token, short_code)
  values
    (p_company_id, v_invited_by, p_target_email, p_target_phone, p_intended_role, v_token, v_short)
  returning * into v_inv;

  return v_inv;
end;
$$;

grant execute on function "filoLocal".create_invitation(
  uuid, "filoLocal".member_role, text, text
) to authenticated;

-- 2) Davet preview: token veya short_code ile kart bilgisini döner (auth gerek YOK)
create or replace function "filoLocal".preview_invitation(
  p_token text default null,
  p_short_code text default null
) returns table (
  invitation_id uuid,
  company_id uuid,
  company_name text,
  intended_role "filoLocal".member_role,
  invited_by_name text,
  expires_at timestamptz,
  status "filoLocal".invitation_status
)
language plpgsql security definer
set search_path = public, "filoLocal"
as $$
begin
  return query
  select i.id, i.company_id, c.name, i.intended_role, u.full_name, i.expires_at, i.status
  from "filoLocal".invitations i
  join "filoLocal".companies c on c.id = i.company_id
  join "filoLocal".users u on u.id = i.invited_by
  where (p_token is not null and i.token = p_token)
     or (p_short_code is not null and i.short_code = p_short_code);
end;
$$;

grant execute on function "filoLocal".preview_invitation(text, text) to anon, authenticated;

-- 3) Davet kabul: oturum açmış kullanıcı bunu çağırır, üyelik atanır
create or replace function "filoLocal".accept_invitation(
  p_token text default null,
  p_short_code text default null
) returns "filoLocal".company_members
language plpgsql security definer
set search_path = public, "filoLocal"
as $$
declare
  v_user_id uuid := auth.uid();
  v_inv "filoLocal".invitations;
  v_member "filoLocal".company_members;
begin
  if v_user_id is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  select * into v_inv
  from "filoLocal".invitations
  where (p_token is not null and token = p_token)
     or (p_short_code is not null and short_code = p_short_code)
  for update;

  if v_inv.id is null then
    raise exception 'invitation_not_found' using errcode = 'P0002';
  end if;
  if v_inv.status <> 'pending' then
    raise exception 'invitation_already_used' using errcode = '22023';
  end if;
  if v_inv.expires_at < now() then
    update "filoLocal".invitations set status = 'expired' where id = v_inv.id;
    raise exception 'invitation_expired' using errcode = '22023';
  end if;

  -- Membership oluştur (idempotent: aynı şirkette ikinci kez davet edilmiş olabilir)
  insert into "filoLocal".company_members (company_id, user_id, role, is_active)
  values (v_inv.company_id, v_user_id, v_inv.intended_role, true)
  on conflict (company_id, user_id) do update
    set role = excluded.role, is_active = true, deleted_at = null
  returning * into v_member;

  update "filoLocal".invitations
     set status = 'accepted', accepted_at = now(), accepted_by = v_user_id
   where id = v_inv.id;

  return v_member;
end;
$$;

grant execute on function "filoLocal".accept_invitation(text, text) to authenticated;;
