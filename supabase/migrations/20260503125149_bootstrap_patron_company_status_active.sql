-- ============================================================================
-- Yeni patron şirketleri default 'active' status'unde başlasın.
-- (Manuel onay akışı v1'de yok — kullanıcı kayıt olur olmaz tüm özellikleri
-- kullanabilmeli.)
-- ============================================================================

create or replace function "filoLocal".bootstrap_patron_company(
  p_name text,
  p_tax_no text default null,
  p_phone text default null,
  p_email text default null
) returns "filoLocal".companies
language plpgsql security definer
set search_path = public, "filoLocal"
as $$
declare
  v_uid uuid := auth.uid();
  v_company "filoLocal".companies;
begin
  if v_uid is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  if exists (
    select 1 from "filoLocal".company_members cm
    where cm.user_id = v_uid and cm.is_active and cm.deleted_at is null
  ) then
    raise exception 'already_member' using errcode = '23505';
  end if;

  insert into "filoLocal".companies (name, tax_no, phone, email, owner_id, status)
  values (p_name, nullif(p_tax_no, ''), nullif(p_phone, ''), nullif(p_email, ''), v_uid, 'active')
  returning * into v_company;

  insert into "filoLocal".company_members (company_id, user_id, role, is_active)
  values (v_company.id, v_uid, 'patron', true);

  return v_company;
end;
$$;

grant execute on function "filoLocal".bootstrap_patron_company(text, text, text, text) to authenticated;

-- Mevcut bekleyen şirketleri de aktive et
update "filoLocal".companies set status = 'active' where status = 'pending';;
