-- jobs.driver_id, jobs.created_by, vehicles.added_by, invitations.invited_by/accepted_by
-- → profiles.id'ye FK (PostgREST embedded join için)

ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_driver_id_fkey,
  ADD CONSTRAINT jobs_driver_id_fkey
    FOREIGN KEY (driver_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_created_by_fkey,
  ADD CONSTRAINT jobs_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.vehicles
  DROP CONSTRAINT IF EXISTS vehicles_added_by_fkey,
  ADD CONSTRAINT vehicles_added_by_fkey
    FOREIGN KEY (added_by) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.invitations
  DROP CONSTRAINT IF EXISTS invitations_invited_by_fkey,
  ADD CONSTRAINT invitations_invited_by_fkey
    FOREIGN KEY (invited_by) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.invitations
  DROP CONSTRAINT IF EXISTS invitations_accepted_by_fkey,
  ADD CONSTRAINT invitations_accepted_by_fkey
    FOREIGN KEY (accepted_by) REFERENCES public.profiles(id);;
