
-- 1) maintenance_requests tablosu
CREATE TABLE public.maintenance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (length(trim(reason)) > 0),
  photo_urls TEXT[] NOT NULL DEFAULT '{}',
  estimated_minutes INT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','expired','cancelled')),
  decided_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  rejection_reason TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT mreq_rejection_consistency CHECK (
    (status <> 'rejected' AND rejection_reason IS NULL) OR
    (status = 'rejected' AND rejection_reason IS NOT NULL AND length(trim(rejection_reason)) > 0)
  )
);

CREATE INDEX idx_mreq_org_vehicle ON public.maintenance_requests(organization_id, vehicle_id);
CREATE INDEX idx_mreq_pending ON public.maintenance_requests(status) WHERE status = 'pending';
CREATE INDEX idx_mreq_requester ON public.maintenance_requests(requester_id);

COMMENT ON TABLE public.maintenance_requests IS
  'Bakim talepleri. Bir araca ait birden fazla pending talep olabilir.';
COMMENT ON COLUMN public.maintenance_requests.estimated_minutes IS
  'Tahmini bakim suresi (dakika). NULL = belirsiz, otomatik checkout calismaz.';
COMMENT ON COLUMN public.maintenance_requests.photo_urls IS
  'Cloudinary secure_url listesi. Multi-foto destegi.';

-- 2) vehicles tablosuna bakim state kolonlari (onay sonrasi)
ALTER TABLE public.vehicles ADD COLUMN maintenance_until TIMESTAMPTZ;
ALTER TABLE public.vehicles ADD COLUMN maintenance_started_at TIMESTAMPTZ;
ALTER TABLE public.vehicles ADD COLUMN maintenance_started_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.vehicles ADD COLUMN maintenance_reason TEXT;
ALTER TABLE public.vehicles ADD COLUMN maintenance_photo_urls TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.vehicles.maintenance_until IS
  'Bakim bitis zamani. Asilirsa otomatik checkout (pg_cron sonradan).';

-- 3) yeni permission keys
INSERT INTO public.permission_keys (key, category, is_critical, label_tr, label_en, sort_order) VALUES
  ('vehicles.send_to_maintenance', 'maintenance', false, 'Bakima alma talebi',  'Send to maintenance', 50),
  ('vehicles.approve_maintenance', 'maintenance', true,  'Bakim onaylama',      'Approve maintenance', 51);

-- 4) role default permissions
INSERT INTO public.role_default_permissions (role, key, allowed) VALUES
  ('owner',   'vehicles.send_to_maintenance', true),
  ('manager', 'vehicles.send_to_maintenance', true),
  ('driver',  'vehicles.send_to_maintenance', true),
  ('owner',   'vehicles.approve_maintenance', true),
  ('manager', 'vehicles.approve_maintenance', true),
  ('driver',  'vehicles.approve_maintenance', false);

-- 5) RLS
ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY mreq_org_read ON public.maintenance_requests FOR SELECT
  USING (organization_id = current_user_org_id());

CREATE POLICY mreq_create ON public.maintenance_requests FOR INSERT
  WITH CHECK (
    organization_id = current_user_org_id()
    AND requester_id = auth.uid()
  );

CREATE POLICY mreq_decide ON public.maintenance_requests FOR UPDATE
  USING (organization_id = current_user_org_id())
  WITH CHECK (organization_id = current_user_org_id());;
