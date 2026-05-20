-- Operator-chosen colour for the vehicle (hex, e.g. "#FF7A1A"). When null
-- the UI falls back to the plate-derived gradient so existing rows stay
-- visually unchanged. Stored as text rather than enum so callers can
-- extend the palette without another migration.
alter table public.vehicles
  add column if not exists color text;;
