-- Self-delete account RPC. Magaza zorunlu (Apple App Store + Google Play
-- 2022'den beri zorunlu: uygulama icinden hesap silme yolu olmali).
--
-- Davranis:
--   * Owner'larin self-delete yapamamasi: orgun tum uyeleri yetim kalir.
--     Once ownership transfer veya organization delete yapilmali.
--   * Manager/driver self-delete: profile + iliskili veriler cascade ile temizlenir
--     (notifications, vehicle_assignments). auth.users row'u admin tarafindan
--     silinmesi gerek (security definer + service role).
--
-- Soft delete pattern degil hard delete — 30 gun retention soft delete istenirse
-- ileride profiles.deleted_at + scheduled cleanup cron eklenebilir.
CREATE OR REPLACE FUNCTION public.request_account_deletion()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _role user_role;
  _org_id UUID;
  _other_count INT;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;

  -- Mevcut profile bilgisini al
  SELECT p.role, p.organization_id INTO _role, _org_id
  FROM profiles p
  WHERE p.id = _user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'profile_not_found');
  END IF;

  -- Owner self-delete'i blokla (UI'da da blok ediliyor, server-side double check)
  IF _role = 'owner' THEN
    -- Eger orgda baska uye yoksa, ownership transfer'a gerek yok — organization'i
    -- da silebiliriz (cascade ile her sey gider). Ama yine de UI'dan kullaniciya
    -- onay vermek gerek; bu RPC'de owner'i blokluyoruz, kullanici "filo sil"
    -- yolunu kullansin.
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'owner_must_transfer_or_delete_fleet',
      'message', 'Patron oncce filoyu silmeli veya patronlugu devretmelidir.'
    );
  END IF;

  -- Manager/driver — cascade delete edilebilir veriler:
  --   profiles row → auth.users (cascade), vehicle_assignments (cascade FK varsa),
  --   notifications (recipient_id'ye gore), maintenance_requests (requester_id),
  --   permission_overrides (member_id), invitations (accepted_by)
  -- Cascade FK'lari yoksa manuel sil:
  DELETE FROM notifications WHERE recipient_id = _user_id OR actor_id = _user_id;
  DELETE FROM permission_overrides WHERE user_id = _user_id;

  -- vehicles.current_user_id NULL'a cek (driver kalmis olabilir)
  UPDATE vehicles SET current_user_id = NULL WHERE current_user_id = _user_id;

  -- jobs.driver_id NULL'a cek (devam eden isler organizasyona kalsin)
  UPDATE jobs SET driver_id = NULL WHERE driver_id = _user_id AND status IN ('open', 'assigned');

  -- profiles row sil (auth.users cascade tetiklenecek FK varsa, yoksa admin sil)
  DELETE FROM profiles WHERE id = _user_id;

  -- auth.users sil (admin SECURITY DEFINER ile)
  DELETE FROM auth.users WHERE id = _user_id;

  RETURN jsonb_build_object('ok', true, 'message', 'account_deleted');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_account_deletion() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_account_deletion() TO authenticated;;
