-- Vehicle main photo authenticity check — maintenance_requests'in
-- icin yapildigi 3 katmanli pattern'i araclara da uygula. Patron
-- veya manager arac eklerken/duzenlerken foto yuklediginde edge fn
-- arkada dogrulama yapar; suspected/non_vehicle/missing_exif fotolar
-- VehicleCard'da badge ile gorunur (driver bir aracin foto'sunu
-- baska bir arac yerine kullanmasin diye).

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS suspected_ai BOOLEAN,
  ADD COLUMN IF NOT EXISTS ai_score NUMERIC(4, 3),
  ADD COLUMN IF NOT EXISTS exif_status TEXT
    CHECK (exif_status IS NULL OR exif_status IN ('valid', 'missing', 'suspicious', 'stale')),
  ADD COLUMN IF NOT EXISTS content_class TEXT,
  ADD COLUMN IF NOT EXISTS content_top_label TEXT,
  ADD COLUMN IF NOT EXISTS content_score NUMERIC(4, 3),
  ADD COLUMN IF NOT EXISTS authenticity_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS authenticity_metadata JSONB;

-- Aynisini maintenance_requests'a da ekle (eski migration eksikti — 'stale')
ALTER TABLE public.maintenance_requests
  DROP CONSTRAINT IF EXISTS maintenance_requests_exif_status_check;
ALTER TABLE public.maintenance_requests
  ADD CONSTRAINT maintenance_requests_exif_status_check
  CHECK (exif_status IS NULL OR exif_status IN ('valid', 'missing', 'suspicious', 'stale'));

-- Index: Patron'un "supheli foto" filtresi
CREATE INDEX IF NOT EXISTS idx_vehicles_authenticity_flagged
  ON public.vehicles (organization_id, status)
  WHERE suspected_ai = true OR content_class = 'non_vehicle' OR exif_status IN ('missing', 'stale');

COMMENT ON COLUMN public.vehicles.exif_status IS
  'valid | missing | suspicious | stale (DateTimeOriginal 30+ gun eski)';;
