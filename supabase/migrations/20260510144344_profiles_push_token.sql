
ALTER TABLE public.profiles ADD COLUMN push_token TEXT;
ALTER TABLE public.profiles ADD COLUMN push_platform TEXT
  CHECK (push_platform IN ('ios','android'));
ALTER TABLE public.profiles ADD COLUMN push_token_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.push_token IS
  'FCM cihaz token (Android) veya FCM uzerinden APNs token (iOS). NULL = push devre disi/kullanici izin vermedi.';
COMMENT ON COLUMN public.profiles.push_platform IS
  'Tokenin geldigi platform — push gonderirken FCM payload sekillendirmek icin.';

CREATE INDEX idx_profiles_push_token ON public.profiles(push_token) WHERE push_token IS NOT NULL;;
