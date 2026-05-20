-- Spec uyumu: yeni driver default status='off_duty' (sadece role='driver' için).
-- Owner/manager 'active' kalır (signup trigger zaten 'active' set ediyor).
-- Tek yer: profiles.status default'u 'off_duty'. Mevcut owner trigger explicit 'active' veriyor.
-- Driver manuel insertler ya da invitation redeem profile yaratırken default'tan faydalanır.
ALTER TABLE public.profiles ALTER COLUMN status SET DEFAULT 'off_duty'::user_availability_status;

-- Mevcut driver'lar (test'tekiler dahil) default'u sıfırlamayacak.
-- Yeni davet edilen şoförler implicit default ile off_duty başlar; mesaiye başlayınca pill ile active yaparlar.;
