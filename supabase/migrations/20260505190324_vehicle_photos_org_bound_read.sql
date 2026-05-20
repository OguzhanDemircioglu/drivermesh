DROP POLICY IF EXISTS "vehicle_photos_read" ON storage.objects;
CREATE POLICY "vehicle_photos_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'vehicle-photos'
    AND (storage.foldername(name))[1]::uuid = public.current_user_org_id()
  );

DROP POLICY IF EXISTS "vehicle_photos_insert" ON storage.objects;
CREATE POLICY "vehicle_photos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'vehicle-photos'
    AND (storage.foldername(name))[1]::uuid = public.current_user_org_id()
  );

DROP POLICY IF EXISTS "vehicle_photos_update" ON storage.objects;
CREATE POLICY "vehicle_photos_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'vehicle-photos'
    AND (storage.foldername(name))[1]::uuid = public.current_user_org_id()
    AND public.current_user_role() = ANY(ARRAY['owner'::public.user_role, 'manager'::public.user_role])
  )
  WITH CHECK (
    bucket_id = 'vehicle-photos'
    AND (storage.foldername(name))[1]::uuid = public.current_user_org_id()
  );

DROP POLICY IF EXISTS "vehicle_photos_delete" ON storage.objects;
CREATE POLICY "vehicle_photos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'vehicle-photos'
    AND (storage.foldername(name))[1]::uuid = public.current_user_org_id()
    AND public.current_user_role() = 'owner'::public.user_role
  );;
