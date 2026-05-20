-- Customer notifications — yolcu uygulamasının kendi notification log'u.
-- Fleet'in public.notifications tablosu organization_id'ye bağlı (müdür/şoför için).
-- Yolcu customer auth ile gelir, org'a ait değil — ayrı tablo gerekli.

CREATE TABLE IF NOT EXISTS customer_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_notifications_customer
  ON customer_notifications(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_notifications_unread
  ON customer_notifications(customer_id, created_at DESC)
  WHERE read_at IS NULL;

ALTER TABLE customer_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cn_self_select ON customer_notifications;
CREATE POLICY cn_self_select ON customer_notifications
  FOR SELECT USING (
    customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS cn_self_update ON customer_notifications;
CREATE POLICY cn_self_update ON customer_notifications
  FOR UPDATE USING (
    customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid())
  );

COMMENT ON TABLE customer_notifications IS 'Yolcu uygulamasının push notification history''si. Edge Function''lar FCM/APNs gönderirken bu tabloya da insert eder; ride app Notifications ekranı buradan okur.';
COMMENT ON COLUMN customer_notifications.type IS 'ride_searching_started | ride_assigned | ride_driver_arrived | ride_started | ride_completed | ride_cancelled_by_driver | ride_no_drivers | payment_reminder | rating_reminder | general';;
