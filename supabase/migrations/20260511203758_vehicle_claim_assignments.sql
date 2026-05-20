
-- 1) vehicles tablosuna current_user_id kolonu
ALTER TABLE public.vehicles
  ADD COLUMN current_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE INDEX idx_vehicles_current_user_id
  ON public.vehicles(current_user_id)
  WHERE current_user_id IS NOT NULL;
COMMENT ON COLUMN public.vehicles.current_user_id IS
  'Araci o anda ustune almis kullanici. Bir kullanici ayni anda yalnizca 1 araca sahip; baska arac claim edince eski otomatik birakilir.';

-- 2) vehicle_assignments history tablosu
CREATE TABLE public.vehicle_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_at TIMESTAMPTZ,
  reason TEXT NOT NULL DEFAULT 'manual'
    CHECK (reason IN ('manual','job_start','transfer','released_by_other'))
);
CREATE INDEX idx_va_vehicle ON public.vehicle_assignments(vehicle_id);
CREATE INDEX idx_va_user_active ON public.vehicle_assignments(user_id) WHERE released_at IS NULL;

COMMENT ON TABLE public.vehicle_assignments IS
  'Vehicle claim/release tarihcesi. Kim ne zaman aldi/birakti ve sebep.';

-- 3) RLS
ALTER TABLE public.vehicle_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY va_org_read ON public.vehicle_assignments FOR SELECT
  USING (organization_id = current_user_org_id());
CREATE POLICY va_insert_self ON public.vehicle_assignments FOR INSERT
  WITH CHECK (organization_id = current_user_org_id() AND user_id = auth.uid());
CREATE POLICY va_update_self ON public.vehicle_assignments FOR UPDATE
  USING (organization_id = current_user_org_id())
  WITH CHECK (organization_id = current_user_org_id());

-- 4) Helper RPC: atomik claim
-- - Kullaniciya ait varsa eski aracta released_at=NOW + vehicle.current_user_id=NULL
-- - Aracta eski kullanici varsa onun released_at=NOW (reason=released_by_other)
-- - Yeni assignment INSERT + vehicle.current_user_id = userId
CREATE OR REPLACE FUNCTION public.claim_vehicle(
  p_vehicle_id UUID,
  p_reason TEXT DEFAULT 'manual'
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_org UUID;
  v_old_vehicle UUID;
  v_old_user UUID;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_reason NOT IN ('manual','job_start','transfer') THEN
    RAISE EXCEPTION 'invalid_reason';
  END IF;

  SELECT organization_id, current_user_id
    INTO v_org, v_old_user
    FROM public.vehicles
    WHERE id = p_vehicle_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'vehicle_not_found'; END IF;
  IF v_org <> current_user_org_id() THEN RAISE EXCEPTION 'cross_org'; END IF;

  -- Kullanicinin onceki araci
  SELECT vehicle_id INTO v_old_vehicle
    FROM public.vehicle_assignments
    WHERE user_id = v_user AND released_at IS NULL
    LIMIT 1;

  -- Onceki kullanicinin claim'i (eger arac baskasinda idi)
  IF v_old_user IS NOT NULL AND v_old_user <> v_user THEN
    UPDATE public.vehicle_assignments
      SET released_at = NOW(), reason = 'released_by_other'
      WHERE vehicle_id = p_vehicle_id AND user_id = v_old_user AND released_at IS NULL;
  END IF;

  -- Kullanicinin onceki aracinin claim'i
  IF v_old_vehicle IS NOT NULL AND v_old_vehicle <> p_vehicle_id THEN
    UPDATE public.vehicle_assignments
      SET released_at = NOW()
      WHERE user_id = v_user AND released_at IS NULL;
    UPDATE public.vehicles
      SET current_user_id = NULL
      WHERE id = v_old_vehicle AND current_user_id = v_user;
  END IF;

  -- Hala bu araci kendisi tutuyorsa idempotent
  IF v_old_user = v_user THEN
    RETURN;
  END IF;

  INSERT INTO public.vehicle_assignments (organization_id, vehicle_id, user_id, reason)
    VALUES (v_org, p_vehicle_id, v_user, p_reason);

  UPDATE public.vehicles
    SET current_user_id = v_user
    WHERE id = p_vehicle_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_vehicle(
  p_vehicle_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_org UUID;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  SELECT organization_id INTO v_org FROM public.vehicles WHERE id = p_vehicle_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'vehicle_not_found'; END IF;
  IF v_org <> current_user_org_id() THEN RAISE EXCEPTION 'cross_org'; END IF;

  UPDATE public.vehicle_assignments
    SET released_at = NOW()
    WHERE vehicle_id = p_vehicle_id AND user_id = v_user AND released_at IS NULL;

  UPDATE public.vehicles
    SET current_user_id = NULL
    WHERE id = p_vehicle_id AND current_user_id = v_user;
END;
$$;;
