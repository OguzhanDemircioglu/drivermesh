-- ============================================================================
-- 0013: PUBLIC rolünden EXECUTE'u kaldır.
-- PostgreSQL'de yeni fonksiyonlar default PUBLIC'e EXECUTE alır;
-- anon/authenticated bunu PUBLIC üzerinden miras alır.
-- Önce PUBLIC'ten revoke, sonra istenen rollere açıkça grant.
-- ============================================================================

-- Tüm fonksiyonlardan PUBLIC EXECUTE'u kaldır
do $$
declare
  r record;
begin
  for r in
    select format('%I.%I(%s)',
                  n.nspname, p.proname,
                  pg_get_function_identity_arguments(p.oid)) as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'filoLocal'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;

-- RPC olarak kullanılması istenenleri yeniden aç
grant execute on function "filoLocal".create_invitation(
  uuid, "filoLocal".member_role, text, text
) to authenticated;

grant execute on function "filoLocal".accept_invitation(text, text) to authenticated;

grant execute on function "filoLocal".preview_invitation(text, text) to anon, authenticated;

grant execute on function "filoLocal".bootstrap_patron_company(text, text, text, text) to authenticated;

-- Hook (sadece auth admin)
grant execute on function "filoLocal".custom_access_token_hook(jsonb) to supabase_auth_admin;

-- Default privilege: yeni eklenecek fonksiyonların PUBLIC'e grant alması engellensin
alter default privileges in schema "filoLocal" revoke execute on functions from public;
alter default privileges for role postgres in schema "filoLocal"
  revoke execute on functions from public, anon, authenticated;

notify pgrst, 'reload config';;
