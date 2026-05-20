-- app_versions: previously keyed by (platform) only → fleet + ride share the
-- same row. A fleet release inadvertently force-updates ride customers.
-- Add `app` discriminator + (platform, app) composite PK, seed ride rows.

ALTER TABLE public.app_versions
  ADD COLUMN IF NOT EXISTS app text NOT NULL DEFAULT 'fleet'
    CHECK (app IN ('fleet', 'ride'));

ALTER TABLE public.app_versions
  DROP CONSTRAINT IF EXISTS app_versions_pkey;
ALTER TABLE public.app_versions
  ADD CONSTRAINT app_versions_pkey PRIMARY KEY (platform, app);

INSERT INTO public.app_versions
  (platform, app, latest_version, min_supported_version,
   release_notes_tr, release_notes_en,
   force_update_message_tr, force_update_message_en, store_url)
VALUES
  ('android', 'ride', '0.1.0', '0.1.0',
   'Ilk surum: arac cagir, aktif yolculuk, sofor degerlendirme',
   'Initial release: request ride, active trip, driver rating',
   'Bu surumu desteklemiyoruz. Devam etmek icin guncelleyin.',
   'This version is no longer supported. Please update to continue.',
   'https://play.google.com/store/apps/details?id=com.drivermesh.ride'),
  ('ios', 'ride', '0.1.0', '0.1.0',
   'iOS surumu yakinda',
   'iOS version coming soon',
   'Bu surumu desteklemiyoruz. Devam etmek icin guncelleyin.',
   'This version is no longer supported. Please update to continue.',
   'https://apps.apple.com/app/drivermesh-ride/id0000000000')
ON CONFLICT (platform, app) DO NOTHING;

COMMENT ON COLUMN public.app_versions.app IS 'Discriminator: ''fleet'' (com.drivermesh.android) or ''ride'' (com.drivermesh.ride). Each app filters by (platform, app).';;
