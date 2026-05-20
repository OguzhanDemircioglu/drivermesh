CREATE TYPE user_availability_status AS ENUM
  ('active','break','off_duty','on_trip','unavailable');

ALTER TABLE profiles
  ADD COLUMN status user_availability_status NOT NULL DEFAULT 'off_duty',
  ADD COLUMN status_updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN pre_trip_status user_availability_status;;
