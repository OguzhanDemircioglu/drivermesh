# Sıkça Sorulan Sorular (SSS)

## Genel

### DriverMesh nedir?
DriverMesh, küçük-orta ölçekli filolar için Türkçe odaklı mobil filo yönetim uygulamasıdır. Owner (patron), manager (yönetici) ve driver (şoför) rolleriyle çalışır. Araç envanteri, iş atama, bakım onayı ve müşteri yolculuk talepleri tek uygulama içinde yönetilir.

### Demo modu ne yapar?
Welcome ekranında **"Demo App"** butonu seninle test bir filoyu paylaşır: 5 araç, 6 kişi, çeşitli durumlardaki işler. Gerçek backend'e bağlanmadan bütün akışı denersin. Verilerin yalnızca kendi cihazında saklanır, başkasına gitmez.

### Hangi cihazlarda çalışır?
- **Android 7.0+** (API 24+) — şu an aktif
- iOS — ertelendi (Apple Developer üyeliği sonrası)

## Araçlar

### Bir araç bakımda iken iş atayabilir miyim?
Hayır. Backend `request_ride` ve `assign_job` RPC'leri kontrol eder: `vehicle.maintenance_started_at IS NULL` olmalı. Aksi halde T9 hatası döner.

### Bir araç birden fazla şoför üzerine alabilir mi?
Hayır. Bir araç aynı anda **tek** bir kişinin üzerinde olur (`vehicles.current_user_id` UUID, single). Ama bir kişi aynı anda **birden fazla** araç üzerinde olabilir.

### Aracı yanlışlıkla bakıma aldım, geri alabilir miyim?
Evet. Bakım talebi `status = 'pending'` durumdaysa **iptal** edebilirsin (talep eden veya owner). Onaylanmış (`approved`) bakımda araç `status = 'maintenance'` olur — owner/manager **bakımdan çıkar** butonuyla geri alabilir.

## İşler

### Bir işi iptal edebilir miyim?
Evet, owner/manager iptal edebilir. Driver'ın bu yetkisi yok (default). `cancelled` durumdaki iş düzenlenemez, ama görüntülenebilir.

### Driver kendi iş oluşturabilir mi?
Default olarak hayır. Owner driver'a `jobs.create` izni verirse, driver kendi self-request iş açabilir (`source = 'driver_request'`).

### Bir iş aynı anda 2 driver'a atanabilir mi?
Hayır. `jobs.driver_id` tek değer. Yeniden atama yapılabilir (eski driver'a "iş geri alındı" bildirimi gider).

## Ekip ve İzinler

### Davet kodumu kaybettim, ne yapayım?
Davet eden owner/manager **Ekip > Bekleyen Davetler** bölümünde davete tap → **"Davet Kodunu Tekrar Gönder"** ile e-posta tekrar atılır. Veya yeni davet oluşturulur (eski 7 gün sonra otomatik siliniyor zaten).

### Bir kişiyi ekipten çıkardığımda işleri ne olur?
- Üzerindeki araçlar serbest bırakılır (`current_user_id = NULL`)
- Aktif (`assigned`, `in_progress`) işleri `created` durumuna döner — yeniden atanmalı
- Tamamlanmış işleri geçmişte kalır, silinmez

### Manager başka manager'ın şoförlerini görebilir mi?
V0.1'de Phase 1 — Manager tüm filo üyelerini görebilir. Phase 2 RLS gelmesiyle sadece kendi `manager_id`'sinin altındaki şoförleri görür (hierarchy scope filter).

## Bildirimler

### Push bildirimleri nasıl çalışır?
- İlk girişte izin sorusu gelir (Android 13+)
- FCM token Firebase'e kayıt olur, `profiles.push_token` alanına yazılır
- Sunucu olayı (`send-push` Edge Function) → FCM → cihaz banner
- 14 farklı bildirim tipi var: yeni iş, bakım onayı bekleniyor, izin değişikliği, davet, ride request, vs.

### Bildirime tap edince ilgili ekran açılıyor mu?
Evet (V0.1'de aktif). FCM payload `data.screen` field'ı route'u verir (`driver_ride`, `job`, `notification` gibi), `pushNotifications.routeForPushPayload` handler'ı ilgili ekrana navigate eder.

## Bakım

### Bakım foto'mu kontrol ediliyor mu?
Evet. Yüklediğin foto otomatik 3 katmanlı kontrol geçer:
- **EXIF metadata** — foto tarihi, kamera modeli (yok ise "EXIF eksik" badge)
- **AI suspect** — AI-generated mi ML modeli skoru (>0.7 ise "AI şüphesi" badge)
- **İçerik sınıfı** — vehicle / non_vehicle (yanlış foto ise "Yanlış içerik" badge)

Onay verecek owner/manager bu badge'leri görür, kararı verirken bilgi olarak kullanır. Otomatik red yok.

### Bakım süresi otomatik biter mi?
Evet. `maintenance_until` set edildiğinde, dakikalık `maintenance-cron` Edge Function çalışır. Süresi geçen araçları otomatik `idle` durumuna çevirir + driver/manager'a bildirim gönderir.

## Ride

### Müşteri filosunu görmüyor — neden?
Aşağıdaki maddeleri sırayla kontrol et:
1. **Hesap > Ride Ayarları** açık mı? (`ride_enabled = true`)
2. Aracın status'u `idle` mi? (bakımda veya aktif iş varsa görünmez)
3. Driver üzerinde mi? (`current_user_id`)
4. Driver `profile.status = 'active'` mi? (mola/mesai dışı değil)
5. Müşteri pickup konumu hizmet alanın içinde mi? (varsayılan 30 km HQ buffer)
6. Mesai içinde mi? (`operating_hours`)

## Diğer

### Sentry crash report açık mı?
Evet. Tüm sürümlerde Sentry SDK aktif, hata olduğunda otomatik raporlanır. Test cihazlarında `Open debugger to view warnings` toast'ı dev build'lerde görünür (release'de yok).

### Telegram destek botum nasıl çalışır?
**Hesap > Destek** ekranından sorun bildiriminde bulunabilirsin. Mesajın repo sahibi Telegram bot üzerinden destek hesabına gider. Demo modunda gönderim devre dışı (sadece UI test).

### Verileri nasıl silebilirim?
**Hesap > Hesabı Sil** akışı V0.1'de planlandı, V0.2'de aktif olur. Şimdilik destek formundan talep et — backend'de manuel soft-delete yapılır.
