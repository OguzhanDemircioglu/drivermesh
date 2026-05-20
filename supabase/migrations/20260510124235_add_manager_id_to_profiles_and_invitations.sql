
ALTER TABLE public.profiles
  ADD COLUMN manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE INDEX idx_profiles_manager_id ON public.profiles(manager_id);
COMMENT ON COLUMN public.profiles.manager_id IS
  'Hiyerarsi: driver icin baglı oldugu manager. owner ve manager icin NULL. Yetim driver da NULL olabilir.';

ALTER TABLE public.invitations
  ADD COLUMN manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.invitations.manager_id IS
  'Driver davet edilirken atanacak manager. accept_invitation icinde profiles.manager_id e tasinir.';;
