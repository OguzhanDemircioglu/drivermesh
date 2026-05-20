-- ============ jobs.source enum ============
DO $$ BEGIN
  CREATE TYPE public.job_source AS ENUM ('internal','driver_request','ride');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS source public.job_source NOT NULL DEFAULT 'internal';

-- ============ Mock: drivermesh ride'dan iş simüle et ============
CREATE OR REPLACE FUNCTION public.simulate_ride_job()
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_org uuid;
  v_job_id uuid;
  v_customers text[] := ARRAY[
    'Yıldız Market #' || (1000 + floor(random()*9000))::int,
    'Aslan Tekstil #' || (1000 + floor(random()*9000))::int,
    'CityFresh #' || (1000 + floor(random()*9000))::int,
    'Tekzen #' || (1000 + floor(random()*9000))::int,
    'KapıdaKahve #' || (1000 + floor(random()*9000))::int
  ];
  v_pickups text[] := ARRAY[
    'Tuzla Soğuk Hava','Esenyurt OSB','Maltepe Depo','Kartal Antrepo','Şişli Hub','Hadımköy Lojistik'
  ];
  v_drops text[] := ARRAY[
    'Bağcılar Pazar','Beylikdüzü Cadde 27','Avcılar Carrefour','Ataşehir Finans','Beşiktaş Şube','Pendik Sahil'
  ];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  SELECT role, organization_id INTO v_role, v_org
  FROM public.profiles WHERE id = v_uid;

  IF v_role NOT IN ('owner','manager') THEN
    RAISE EXCEPTION 'only owner/manager can simulate ride jobs';
  END IF;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'no organization';
  END IF;

  INSERT INTO public.jobs (
    organization_id, source, customer_name,
    pickup_address, dropoff_address,
    distance_km, eta_minutes, status, created_by
  )
  VALUES (
    v_org,
    'ride',
    v_customers[1 + floor(random() * array_length(v_customers,1))::int],
    v_pickups[1 + floor(random() * array_length(v_pickups,1))::int],
    v_drops[1 + floor(random() * array_length(v_drops,1))::int],
    round((10 + random() * 50)::numeric, 1),
    (15 + floor(random() * 60))::int,
    'open',
    v_uid
  )
  RETURNING id INTO v_job_id;

  RETURN v_job_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.simulate_ride_job() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.simulate_ride_job() TO authenticated;;
