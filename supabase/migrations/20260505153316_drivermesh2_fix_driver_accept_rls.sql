-- Driver, açık ve atanmamış işleri görüp kendi adına assign edebilsin.
-- USING (read-eligibility): driver kendi işine VEYA açık-atanmamış işlere erişebilir
-- WITH CHECK (write-eligibility): driver sadece kendi adına atayabilir (driver_id = auth.uid())

DROP POLICY IF EXISTS "members_update_jobs" ON public.jobs;

CREATE POLICY "members_update_jobs" ON public.jobs FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_user_org_id()
    AND (
      public.current_user_role() IN ('owner','manager')
      OR (
        public.current_user_role() = 'driver'
        AND (
          driver_id = auth.uid()
          OR (status = 'open' AND driver_id IS NULL)
        )
      )
    )
  )
  WITH CHECK (
    organization_id = public.current_user_org_id()
    AND (
      public.current_user_role() IN ('owner','manager')
      OR (public.current_user_role() = 'driver' AND driver_id = auth.uid())
    )
  );;
