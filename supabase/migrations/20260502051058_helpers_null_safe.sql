-- ============================================================================
-- 0015: Helper'lar JWT claim'i yokken null dönsün (boş string UUID cast hatası giderildi).
-- ============================================================================

create or replace function "filoLocal".current_company_id()
returns uuid language sql stable security definer
set search_path = public, "filoLocal"
as $$
  select nullif(
    coalesce(current_setting('request.jwt.claims', true)::json ->> 'company_id', ''),
    ''
  )::uuid;
$$;

create or replace function "filoLocal".current_role()
returns "filoLocal".member_role language sql stable security definer
set search_path = public, "filoLocal"
as $$
  select case
    when nullif(current_setting('request.jwt.claims', true)::json ->> 'role', '') is null
      then null
    else (current_setting('request.jwt.claims', true)::json ->> 'role')::"filoLocal".member_role
  end;
$$;

-- Yeniden oluşturulan fonksiyonlar PUBLIC'e default grant aldı, tekrar revoke + grant
revoke execute on function "filoLocal".current_company_id() from public;
revoke execute on function "filoLocal".current_role() from public;
grant execute on function "filoLocal".current_company_id() to authenticated;
grant execute on function "filoLocal".current_role() to authenticated;;
