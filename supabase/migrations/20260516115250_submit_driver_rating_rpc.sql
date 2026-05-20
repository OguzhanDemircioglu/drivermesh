-- submit_driver_rating: simetrik karşılığı submit_rating (customer→driver) için.
-- Driver, tamamladığı ride'da müşteriyi puanlar. Aynı idempotency garantileri:
--   - stars 1..5
--   - sadece ride'ın driver_id'si olan caller puanlayabilir
--   - ride status='completed' olmalı
--   - ratings_ride_request_id_rater_type_key UNIQUE constraint çift puanı engeller

CREATE OR REPLACE FUNCTION public.submit_driver_rating(
  p_ride_id uuid,
  p_stars integer,
  p_comment text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_driver_id uuid;
  v_customer_id uuid;
  v_existing uuid;
  v_rating_id uuid;
BEGIN
  IF p_stars < 1 OR p_stars > 5 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'stars must be 1..5';
  END IF;

  -- Caller bir driver mı? profiles.id = auth.uid() AND role='driver'.
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'driver'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'caller is not a driver';
  END IF;
  v_driver_id := auth.uid();

  -- Ride completed ve caller bu ride'ın driver'ı mı?
  SELECT customer_id INTO v_customer_id
  FROM public.ride_requests
  WHERE id = p_ride_id
    AND driver_id = v_driver_id
    AND status = 'completed';

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ride not completed or not yours';
  END IF;

  -- Daha önce rated mı?
  SELECT id INTO v_existing
  FROM public.ratings
  WHERE ride_request_id = p_ride_id
    AND rater_type = 'driver';

  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'already rated';
  END IF;

  INSERT INTO public.ratings (
    ride_request_id, rater_type, rater_id, ratee_type, ratee_id, stars, comment
  ) VALUES (
    p_ride_id, 'driver', v_driver_id, 'customer', v_customer_id, p_stars, NULLIF(trim(p_comment), '')
  )
  RETURNING id INTO v_rating_id;

  RETURN v_rating_id;
END;
$function$;

COMMENT ON FUNCTION public.submit_driver_rating IS
  'Driver, tamamladığı ride''da müşteriyi puanlar (1..5 yıldız + opsiyonel yorum). UNIQUE (ride_request_id, rater_type=driver) ile çift kayıt önlenir.';;
