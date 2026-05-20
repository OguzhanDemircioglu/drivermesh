-- Force update mekanizmasi tablosu.
-- Client app start'ta + foreground transition'da SELECT yapar:
--   current_version < min_supported_version  -> hard modal (kapatilamaz)
--   current_version < latest_version          -> soft banner (dismiss)
--   current_version >= latest_version          -> ok
--
-- Hard update sadece kritik durumlar icin (security patch, breaking
-- API change, store policy update). Yoksa Apple/Google "user-hostile"
-- diye reject eder. Soft update default.
--
-- RLS: anon + authenticated read access. Yazma sadece service_role
-- (cron veya manual deploy script ile guncellenir).

CREATE TABLE IF NOT EXISTS public.app_versions (
  platform TEXT PRIMARY KEY CHECK (platform IN ('android', 'ios')),
  latest_version TEXT NOT NULL,
  min_supported_version TEXT NOT NULL,
  release_notes_tr TEXT,
  release_notes_en TEXT,
  force_update_message_tr TEXT NOT NULL DEFAULT 'Bu surumu desteklemiyoruz. Devam etmek icin guncelleyin.',
  force_update_message_en TEXT NOT NULL DEFAULT 'This version is no longer supported. Please update to continue.',
  store_url TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone can read app_versions" ON public.app_versions;
CREATE POLICY "anyone can read app_versions"
  ON public.app_versions FOR SELECT
  TO anon, authenticated
  USING (true);

-- Hicbir client write hakki yok — sadece service_role/postgres yazabilir
-- (RLS deny by default for INSERT/UPDATE/DELETE without policy).

-- Initial seed: v1.0.0 production launch
INSERT INTO public.app_versions (
  platform, latest_version, min_supported_version, release_notes_tr,
  release_notes_en, store_url
) VALUES (
  'android', '1.0.0', '1.0.0',
  'Ilk surum: filo yonetimi, bakim talepleri, gercek zamanli harita',
  'Initial release: fleet management, maintenance requests, real-time map',
  'https://play.google.com/store/apps/details?id=com.drivermesh.android'
), (
  'ios', '1.0.0', '1.0.0',
  'iOS surumu yakinda',
  'iOS version coming soon',
  'https://apps.apple.com/app/drivermesh/id0000000000'  -- placeholder
)
ON CONFLICT (platform) DO NOTHING;;
