
-- BUG-DB2 fix: operating_hours default formatı is_fleet_open() ile uyumsuzdu.
-- is_fleet_open her gün için {"start":"...","end":"..."} object array bekliyor
-- ama default value ["...","..."] string array seed ediyordu → yeni org'lar
-- ride'da görünmüyordu (is_fleet_open=false). Default'u doğru formata çek
-- ve mevcut yanlış format satırları güncelle.

-- 1) DEFAULT'u doğru formata güncelle (her gün 00:00-23:59 açık, tz Europe/Istanbul)
ALTER TABLE public.fleets_visibility
  ALTER COLUMN operating_hours SET DEFAULT '{
    "tz": "Europe/Istanbul",
    "mon": [{"start":"00:00","end":"23:59"}],
    "tue": [{"start":"00:00","end":"23:59"}],
    "wed": [{"start":"00:00","end":"23:59"}],
    "thu": [{"start":"00:00","end":"23:59"}],
    "fri": [{"start":"00:00","end":"23:59"}],
    "sat": [{"start":"00:00","end":"23:59"}],
    "sun": [{"start":"00:00","end":"23:59"}]
  }'::jsonb;

-- 2) Mevcut yanlış format satırları (mon değeri object array değilse) düzelt
UPDATE public.fleets_visibility
   SET operating_hours = '{
     "tz": "Europe/Istanbul",
     "mon": [{"start":"00:00","end":"23:59"}],
     "tue": [{"start":"00:00","end":"23:59"}],
     "wed": [{"start":"00:00","end":"23:59"}],
     "thu": [{"start":"00:00","end":"23:59"}],
     "fri": [{"start":"00:00","end":"23:59"}],
     "sat": [{"start":"00:00","end":"23:59"}],
     "sun": [{"start":"00:00","end":"23:59"}]
   }'::jsonb
 WHERE operating_hours IS NOT NULL
   AND (
     jsonb_typeof(operating_hours->'mon') = 'array'
     AND jsonb_array_length(operating_hours->'mon') > 0
     AND jsonb_typeof(operating_hours->'mon'->0) = 'string'
   );;
