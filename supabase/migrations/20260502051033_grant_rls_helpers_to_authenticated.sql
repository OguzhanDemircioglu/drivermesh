-- ============================================================================
-- 0014: RLS helper fonksiyonları için authenticated rolüne EXECUTE ver.
-- RLS policy'leri caller'ın role'ünde değerlendirilir → bu fonksiyonlar
-- içeriden çağrıldığında EXECUTE privilege gerekir.
--
-- GÜVENLİK NOTU: Bu fonksiyonlar yalnızca current_setting('request.jwt.claims')
-- okur; harici state mutate etmezler. RPC olarak doğrudan çağrılsalar bile
-- kullanıcı kendi token'ından zaten okuyabileceği değeri görür → zararsız.
-- Advisor `0029_authenticated_security_definer_function_executable` uyarısı
-- bu yüzden kasıtlı olarak göz ardı edilir.
-- ============================================================================

grant execute on function "filoLocal".current_company_id() to authenticated;
grant execute on function "filoLocal".current_role() to authenticated;
grant execute on function "filoLocal".current_user_type() to authenticated;
grant execute on function "filoLocal".is_patron() to authenticated;
grant execute on function "filoLocal".is_manager_or_above() to authenticated;
grant execute on function "filoLocal".is_employee() to authenticated;;
