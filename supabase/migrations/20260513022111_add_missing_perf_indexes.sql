-- KPI dashboard ve fleet listesinde "X aktif, Y bosta, Z bakimda"
-- sayim sorgusu icin org_id+status composite. idx_vehicles_org tek
-- basina cluster yapisina baglıydı; status filtresinde scan azalir.
CREATE INDEX IF NOT EXISTS idx_vehicles_org_status
  ON public.vehicles (organization_id, status);

-- Vehicle bazinda "su an aktif assignment var mi" check (claim/release
-- TOCTOU pencere icin onemli). idx_va_vehicle(vehicle_id) tum history'yi
-- doner; partial WHERE released_at IS NULL sadece aktif row'lari indexler,
-- 99% smaller pratik kullanimda.
CREATE INDEX IF NOT EXISTS idx_va_vehicle_active
  ON public.vehicle_assignments (vehicle_id)
  WHERE released_at IS NULL;;
