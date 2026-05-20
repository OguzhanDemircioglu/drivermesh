-- ============================================================================
-- 0012: Internal helper'ları anon/authenticated rollerinden revoke et.
-- Schema expose ederken tüm routines'e all grant verilmişti — bu yanlıştı.
-- Sadece RPC olarak çağrılması istenen fonksiyonlar açık kalır.
-- ============================================================================

-- Internal helper'lar (RLS policy ve trigger'lar tarafından kullanılır,
-- doğrudan RPC olarak çağrılmaz)
revoke execute on function "filoLocal".current_company_id() from anon, authenticated;
revoke execute on function "filoLocal".current_role() from anon, authenticated;
revoke execute on function "filoLocal".current_user_type() from anon, authenticated;
revoke execute on function "filoLocal".is_patron() from anon, authenticated;
revoke execute on function "filoLocal".is_manager_or_above() from anon, authenticated;
revoke execute on function "filoLocal".is_employee() from anon, authenticated;
revoke execute on function "filoLocal".tg_set_updated_at() from anon, authenticated;

-- Trigger fonksiyonu — sadece auth.users'a insert sırasında postgres çalıştırır
revoke execute on function "filoLocal".handle_new_auth_user() from anon, authenticated;

-- JWT hook — sadece supabase_auth_admin çağırır
revoke execute on function "filoLocal".custom_access_token_hook(jsonb) from anon, authenticated, public;

-- Default privilege'i daralt: yeni eklenen fonksiyonlar otomatik açılmasın
alter default privileges for role postgres in schema "filoLocal"
  revoke all on routines from anon, authenticated;
alter default privileges for role postgres in schema "filoLocal"
  revoke all on routines from anon, authenticated, service_role;

-- RPC olarak çağrılması istenen fonksiyonların grant'larını açıkça yeniden ver
-- (revoke default'tan etkilendiyse)
grant execute on function "filoLocal".create_invitation(
  uuid, "filoLocal".member_role, text, text
) to authenticated;
grant execute on function "filoLocal".accept_invitation(text, text) to authenticated;
grant execute on function "filoLocal".preview_invitation(text, text) to anon, authenticated;
grant execute on function "filoLocal".bootstrap_patron_company(text, text, text, text) to authenticated;

-- Hook'a grant: sadece supabase_auth_admin
grant execute on function "filoLocal".custom_access_token_hook(jsonb) to supabase_auth_admin;

notify pgrst, 'reload config';;
