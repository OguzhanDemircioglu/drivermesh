INSERT INTO storage.buckets (id, name, public)
VALUES ('vehicle-photos', 'vehicle-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "vehicle_photos_read" ON storage.objects;
CREATE POLICY "vehicle_photos_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'vehicle-photos');

DROP POLICY IF EXISTS "vehicle_photos_insert" ON storage.objects;
CREATE POLICY "vehicle_photos_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'vehicle-photos'
    AND public.current_user_role() IN ('owner','manager')
  );

DROP POLICY IF EXISTS "vehicle_photos_update" ON storage.objects;
CREATE POLICY "vehicle_photos_update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'vehicle-photos'
    AND public.current_user_role() IN ('owner','manager')
  );

DROP POLICY IF EXISTS "vehicle_photos_delete" ON storage.objects;
CREATE POLICY "vehicle_photos_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'vehicle-photos'
    AND public.current_user_role() = 'owner'
  );;
