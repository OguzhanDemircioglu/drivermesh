-- DriverMesh Ride v1 schema — customer-side ride hailing app.
-- Adds: PostGIS + ride enums + customers, ride_requests, ride_offers,
-- payments, ratings, fleets_visibility, fare_config + RLS + auto-create
-- customer trigger + jobs.ride_request_id link.

-- ====================================================================
-- 1) PostGIS extension
-- ====================================================================
CREATE EXTENSION IF NOT EXISTS postgis;

-- ====================================================================
-- 2) Ride enum types
-- ====================================================================
DO $$ BEGIN
  CREATE TYPE ride_status AS ENUM (
    'searching',
    'no_drivers_available',
    'assigned',
    'driver_arrived',
    'in_progress',
    'completed',
    'cancelled_by_customer',
    'cancelled_by_driver',
    'cancelled_by_system'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ride_vehicle_type AS ENUM ('standard', 'comfort', 'xl', 'taxi');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ride_payment_method AS ENUM ('cash', 'card', 'wallet');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ride_payment_status AS ENUM ('pending', 'authorized', 'captured', 'refunded', 'failed', 'paid_cash');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ride_offer_status AS ENUM ('pending', 'accepted', 'rejected', 'expired', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ====================================================================
-- 3) customers
-- ====================================================================
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text UNIQUE NOT NULL,
  full_name text,
  email text,
  avatar_url text,
  default_payment_method ride_payment_method DEFAULT 'cash',
  language text DEFAULT 'tr' CHECK (language IN ('tr','en')),
  push_token text,
  push_platform text CHECK (push_platform IN ('fcm','apns')),
  push_token_updated_at timestamptz,
  blocked boolean DEFAULT false,
  blocked_reason text,
  total_rides int DEFAULT 0,
  avg_rating numeric(2,1),
  last_ride_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customers_self_select ON customers;
CREATE POLICY customers_self_select ON customers
  FOR SELECT USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS customers_self_update ON customers;
CREATE POLICY customers_self_update ON customers
  FOR UPDATE USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

DROP POLICY IF EXISTS customers_self_insert ON customers;
CREATE POLICY customers_self_insert ON customers
  FOR INSERT WITH CHECK (auth_user_id = auth.uid());

-- ====================================================================
-- 4) fleets_visibility — fleet owner toggles ride participation
-- ====================================================================
CREATE TABLE IF NOT EXISTS fleets_visibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid UNIQUE NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ride_enabled boolean DEFAULT false,
  service_area geography(POLYGON, 4326),
  operating_hours jsonb DEFAULT '{"mon":["00:00","23:59"],"tue":["00:00","23:59"],"wed":["00:00","23:59"],"thu":["00:00","23:59"],"fri":["00:00","23:59"],"sat":["00:00","23:59"],"sun":["00:00","23:59"]}'::jsonb,
  vehicle_types_offered text[] DEFAULT ARRAY['standard']::text[],
  base_fare_override numeric(10,2),
  commission_rate numeric(4,2) DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fleets_visibility_area_gist ON fleets_visibility USING GIST (service_area);
CREATE INDEX IF NOT EXISTS idx_fleets_visibility_enabled ON fleets_visibility(ride_enabled) WHERE ride_enabled = true;

ALTER TABLE fleets_visibility ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fv_owner_all ON fleets_visibility;
CREATE POLICY fv_owner_all ON fleets_visibility
  FOR ALL USING (
    organization_id = (SELECT p.organization_id FROM profiles p WHERE p.id = auth.uid())
    AND (SELECT p.role FROM profiles p WHERE p.id = auth.uid()) = 'owner'
  )
  WITH CHECK (
    organization_id = (SELECT p.organization_id FROM profiles p WHERE p.id = auth.uid())
    AND (SELECT p.role FROM profiles p WHERE p.id = auth.uid()) = 'owner'
  );

-- ====================================================================
-- 5) fare_config — region+vehicle bazlı tarife (MVP'de seed İstanbul standard)
-- ====================================================================
CREATE TABLE IF NOT EXISTS fare_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_code text NOT NULL,
  vehicle_type ride_vehicle_type NOT NULL,
  base_fare numeric(10,2) NOT NULL,
  per_km numeric(10,2) NOT NULL,
  per_min numeric(10,2) NOT NULL,
  min_fare numeric(10,2) NOT NULL,
  surge_enabled boolean DEFAULT false,
  effective_from timestamptz DEFAULT now(),
  effective_until timestamptz,
  UNIQUE (region_code, vehicle_type, effective_from)
);

ALTER TABLE fare_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fc_public_read ON fare_config;
CREATE POLICY fc_public_read ON fare_config FOR SELECT USING (true);

-- Seed: İstanbul standard fare (base ₺30 + ₺12/km + ₺2/dk, min ₺50)
INSERT INTO fare_config (region_code, vehicle_type, base_fare, per_km, per_min, min_fare)
SELECT 'IST', 'standard', 30.00, 12.00, 2.00, 50.00
WHERE NOT EXISTS (
  SELECT 1 FROM fare_config WHERE region_code='IST' AND vehicle_type='standard'
);

-- ====================================================================
-- 6) ride_requests — main state machine
-- ====================================================================
CREATE TABLE IF NOT EXISTS ride_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,

  organization_id uuid REFERENCES organizations(id),
  vehicle_id uuid REFERENCES vehicles(id),
  driver_id uuid REFERENCES profiles(id),
  job_id uuid UNIQUE REFERENCES jobs(id) ON DELETE SET NULL,

  pickup_point geography(POINT, 4326) NOT NULL,
  pickup_address text NOT NULL,
  dropoff_point geography(POINT, 4326) NOT NULL,
  dropoff_address text NOT NULL,

  vehicle_type ride_vehicle_type DEFAULT 'standard',
  fare_estimate numeric(10,2) NOT NULL,
  fare_final numeric(10,2),
  distance_km numeric(6,2),
  duration_min int,
  surge_multiplier numeric(3,2) DEFAULT 1.0,

  status ride_status NOT NULL DEFAULT 'searching',
  cancel_reason text,

  payment_method ride_payment_method NOT NULL DEFAULT 'cash',
  payment_status ride_payment_status DEFAULT 'pending',

  requested_at timestamptz DEFAULT now(),
  assigned_at timestamptz,
  arrived_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ride_requests_pickup_gist ON ride_requests USING GIST (pickup_point);
CREATE INDEX IF NOT EXISTS idx_ride_requests_status ON ride_requests(status)
  WHERE status IN ('searching','assigned','in_progress','driver_arrived');
CREATE INDEX IF NOT EXISTS idx_ride_requests_customer ON ride_requests(customer_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_ride_requests_driver ON ride_requests(driver_id, requested_at DESC)
  WHERE driver_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ride_requests_org ON ride_requests(organization_id, requested_at DESC)
  WHERE organization_id IS NOT NULL;

ALTER TABLE ride_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rr_customer_select ON ride_requests;
CREATE POLICY rr_customer_select ON ride_requests
  FOR SELECT USING (
    customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS rr_customer_insert ON ride_requests;
CREATE POLICY rr_customer_insert ON ride_requests
  FOR INSERT WITH CHECK (
    customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid())
    AND status = 'searching'
  );

DROP POLICY IF EXISTS rr_customer_update ON ride_requests;
CREATE POLICY rr_customer_update ON ride_requests
  FOR UPDATE USING (
    customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS rr_driver_select ON ride_requests;
CREATE POLICY rr_driver_select ON ride_requests
  FOR SELECT USING (driver_id = auth.uid());

DROP POLICY IF EXISTS rr_org_staff_select ON ride_requests;
CREATE POLICY rr_org_staff_select ON ride_requests
  FOR SELECT USING (
    organization_id = (SELECT p.organization_id FROM profiles p WHERE p.id = auth.uid())
    AND (SELECT p.role FROM profiles p WHERE p.id = auth.uid()) IN ('owner','manager')
  );

-- ====================================================================
-- 7) ride_offers — fan-out to candidate drivers
-- ====================================================================
CREATE TABLE IF NOT EXISTS ride_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_request_id uuid NOT NULL REFERENCES ride_requests(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES profiles(id),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id),
  organization_id uuid NOT NULL REFERENCES organizations(id),

  priority int NOT NULL,
  eta_seconds int NOT NULL,
  distance_meters int NOT NULL,

  status ride_offer_status DEFAULT 'pending',
  offered_at timestamptz DEFAULT now(),
  responded_at timestamptz,
  expires_at timestamptz NOT NULL,

  UNIQUE (ride_request_id, driver_id)
);

CREATE INDEX IF NOT EXISTS idx_ride_offers_driver_pending ON ride_offers(driver_id, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_ride_offers_request ON ride_offers(ride_request_id, priority);

ALTER TABLE ride_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ro_driver_select ON ride_offers;
CREATE POLICY ro_driver_select ON ride_offers
  FOR SELECT USING (driver_id = auth.uid());

DROP POLICY IF EXISTS ro_customer_select ON ride_offers;
CREATE POLICY ro_customer_select ON ride_offers
  FOR SELECT USING (
    ride_request_id IN (
      SELECT id FROM ride_requests
      WHERE customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid())
    )
  );

-- ====================================================================
-- 8) payments — MVP'de placeholder (kapıda nakit, app para akışına dokunmaz)
-- ====================================================================
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_request_id uuid NOT NULL REFERENCES ride_requests(id) ON DELETE RESTRICT,
  method ride_payment_method NOT NULL,
  gateway text,
  gateway_ref text,
  amount numeric(10,2) NOT NULL,
  currency text DEFAULT 'TRY',
  status ride_payment_status DEFAULT 'pending',
  gateway_payload jsonb,
  failure_reason text,
  created_at timestamptz DEFAULT now(),
  authorized_at timestamptz,
  captured_at timestamptz,
  refunded_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_payments_ride ON payments(ride_request_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status) WHERE status IN ('pending','authorized');

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pay_customer_select ON payments;
CREATE POLICY pay_customer_select ON payments FOR SELECT USING (
  ride_request_id IN (
    SELECT id FROM ride_requests
    WHERE customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid())
  )
);

-- ====================================================================
-- 9) ratings — V1'de aktif, MVP'de tablo dursun
-- ====================================================================
CREATE TABLE IF NOT EXISTS ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_request_id uuid NOT NULL REFERENCES ride_requests(id) ON DELETE CASCADE,
  rater_type text NOT NULL CHECK (rater_type IN ('customer','driver')),
  rater_id uuid NOT NULL,
  ratee_type text NOT NULL CHECK (ratee_type IN ('customer','driver')),
  ratee_id uuid NOT NULL,
  stars int NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz DEFAULT now(),

  UNIQUE (ride_request_id, rater_type)
);

CREATE INDEX IF NOT EXISTS idx_ratings_ratee ON ratings(ratee_type, ratee_id);

ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rt_self_select ON ratings;
CREATE POLICY rt_self_select ON ratings FOR SELECT USING (
  (rater_type = 'customer' AND rater_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid()))
  OR (ratee_type = 'customer' AND ratee_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid()))
  OR (rater_type = 'driver' AND rater_id = auth.uid())
  OR (ratee_type = 'driver' AND ratee_id = auth.uid())
);

-- ====================================================================
-- 10) jobs tablosuna ride_request_id link (mevcut jobs tablosuna kolon)
-- ====================================================================
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS ride_request_id uuid REFERENCES ride_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_ride_request ON jobs(ride_request_id) WHERE ride_request_id IS NOT NULL;

-- ====================================================================
-- 11) Auto-create customer on phone OTP signup
-- Trigger sadece phone'lu + email'siz auth.users (passwordless OTP) için
-- customer satırı oluşturur. Fleet kullanıcıları email signup → customer
-- yaratılmaz.
-- ====================================================================
CREATE OR REPLACE FUNCTION public.create_customer_on_phone_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.phone IS NOT NULL
     AND NEW.phone <> ''
     AND (NEW.email IS NULL OR NEW.email = '')
  THEN
    INSERT INTO public.customers (auth_user_id, phone)
    VALUES (NEW.id, NEW.phone)
    ON CONFLICT (auth_user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_customer ON auth.users;
CREATE TRIGGER on_auth_user_created_customer
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_customer_on_phone_signup();;
