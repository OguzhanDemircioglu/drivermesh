-- Photo authenticity check: maintenance_requests'a 3 katmanli dogrulama
-- alanlari ekle. Edge fn `photo-authenticity-check` v5 (deploy edilecek)
-- her foto icin EXIF + AI-detector + content classifier sonucu tek
-- ozet halinde row'a yazar (per-request aggregate, per-photo degil —
-- talep cogu zaman 1-3 foto icerir, en kotu skor row'a kaydedilir).

ALTER TABLE public.maintenance_requests
  ADD COLUMN IF NOT EXISTS suspected_ai BOOLEAN,
  ADD COLUMN IF NOT EXISTS ai_score NUMERIC(4, 3),
  ADD COLUMN IF NOT EXISTS exif_status TEXT
    CHECK (exif_status IS NULL OR exif_status IN ('valid', 'missing', 'suspicious')),
  ADD COLUMN IF NOT EXISTS content_class TEXT,
  ADD COLUMN IF NOT EXISTS content_top_label TEXT,
  ADD COLUMN IF NOT EXISTS content_score NUMERIC(4, 3),
  ADD COLUMN IF NOT EXISTS authenticity_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS authenticity_metadata JSONB;

-- Index: Patron'un "supheli foto" filtre query'si icin
CREATE INDEX IF NOT EXISTS idx_mreq_authenticity_flagged
  ON public.maintenance_requests (organization_id, status, authenticity_checked_at DESC)
  WHERE suspected_ai = true OR content_class = 'non_vehicle' OR exif_status = 'missing';

COMMENT ON COLUMN public.maintenance_requests.suspected_ai IS
  'Hugging Face AI-image-detector: true ise foto AI ile uretilmis suphesi (ai_score > 0.5)';
COMMENT ON COLUMN public.maintenance_requests.content_class IS
  'vehicle | non_vehicle | unknown — ImageNet classifier top-5 vehicle synonym match';
COMMENT ON COLUMN public.maintenance_requests.exif_status IS
  'valid: kamera EXIF var | missing: hic EXIF yok (download/screenshot) | suspicious: yamanmis';
COMMENT ON COLUMN public.maintenance_requests.authenticity_metadata IS
  'Per-photo raw metadata: { photos: [{ url, exif, ai_label, ai_score, top_labels[], top_score }] }';;
