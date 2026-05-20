-- HQ (logistics base) on organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS hq_lat double precision,
  ADD COLUMN IF NOT EXISTS hq_lng double precision,
  ADD COLUMN IF NOT EXISTS hq_address text;

-- Pickup / dropoff coordinates on jobs
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS pickup_lat double precision,
  ADD COLUMN IF NOT EXISTS pickup_lng double precision,
  ADD COLUMN IF NOT EXISTS dropoff_lat double precision,
  ADD COLUMN IF NOT EXISTS dropoff_lng double precision;

-- Helpful index for active jobs (in_progress) when computing animation/positions
CREATE INDEX IF NOT EXISTS idx_jobs_org_active
  ON public.jobs(organization_id)
  WHERE status IN ('assigned','in_progress');

COMMENT ON COLUMN public.organizations.hq_lat IS 'Logistics HQ latitude (set by owner from map picker)';
COMMENT ON COLUMN public.organizations.hq_lng IS 'Logistics HQ longitude';
COMMENT ON COLUMN public.organizations.hq_address IS 'Friendly HQ label (reverse-geocode or manual)';
COMMENT ON COLUMN public.jobs.pickup_lat IS 'Pickup latitude (HQ or map-picked)';
COMMENT ON COLUMN public.jobs.pickup_lng IS 'Pickup longitude';
COMMENT ON COLUMN public.jobs.dropoff_lat IS 'Dropoff latitude (always map-picked)';
COMMENT ON COLUMN public.jobs.dropoff_lng IS 'Dropoff longitude';;
