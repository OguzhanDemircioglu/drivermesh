# DriverMesh — Test Senaryoları ve Doğrulama Rehberi

> Bu doküman uygulamanın **manuel ve yarı-otomatik testlerinin nasıl yapılacağını** ve sonuç beklentilerini açıklar. Chatbot için: kullanıcı "X özelliği nasıl test edilir" sorduğunda buradan cevap üret.

---

## 1. Test Ortamları

### Demo Mode
- Welcome → "Demo App" → owner perspektifinden başlar
- AsyncStorage tabanlı in-memory state — Supabase'e gitmez
- 1 owner + 1 manager + 3 driver, 5 araç, 7 job, 1 invitation seed
- **Avantaj:** offline çalışır, hızlı reset (account → "Filo Sil")
- **Limit:** rol değiştirme yok (owner perspektifinden mahsur), gerçek push gönderilmez, gerçek Cloudinary'ye gidilmez

### Production
- Gerçek Supabase ile login (email + parola)
- RLS aktif, gerçek push, gerçek Cloudinary, gerçek pg_cron
- **Setup:** geliştirme öncesi `npx expo run:android` ile native build, FCM service account JSON ve `anon_key` vault secret'ı

### Telefon (USB ADB)
Bu projedeki test örnekleri Xiaomi / Pixel benzeri Android cihazlardan ADB ile yapıldı:

```bash
adb devices                         # Cihaz bağlı mı
adb reverse tcp:8081 tcp:8081       # Metro localhost erişimi
adb shell wm size                   # Ekran çözünürlüğü (örn 720x1650)
adb shell input tap X Y             # Tıklama
adb shell input swipe X1 Y1 X2 Y2 D # Kaydırma
adb shell input text "%s..."        # Metin (boşluk %s ile)
adb shell input keyevent CODE       # KEYCODE_BACK gibi
adb exec-out screencap -p > out.png # Ekran görüntüsü
adb shell uiautomator dump //sdcard/ui.xml && adb pull //sdcard/ui.xml ui.xml
                                    # UI hierarchy + bounds
adb shell am force-stop com.drivermesh.android
adb shell "monkey -p com.drivermesh.android -c android.intent.category.LAUNCHER 1"
```

**ÖNEMLİ:** Tap koordinatları için **uiautomator dump** ile gerçek bounds bul. Ekran görüntüsünü piksel ölçümle yapmak yanlış sonuç verir (status bar / nav bar offset).

---

## 2. Smoke Test (Hızlı Sağlık Kontrolü)

10-15 dakika. Her release öncesi:

| # | Adım | Beklenen |
|---|---|---|
| 1 | Welcome açılıyor | Logo + tagline + "Demo App" + "Giriş Yap" + "Filo Başlat" + "Davet Kodum Var" |
| 2 | Demo App tıkla | Home dashboard ("İyi Günler, Demo") |
| 3 | "1 aktif sürüş" CANLI strip görünür | Strip + "Haritada gör" link |
| 4 | "3 aktif · 1 boşta · 1 bakımda" | Vehicle status counts doğru (demo seed bu sayıları üretir) |
| 5 | Filo tab → 5 araç listede | 34 ABC 123 (Aktif), 34 DEF 456 (Aktif), 06 GHI 789 (Aktif), 34 JKL 234 (Bakımda — sarı badge), 35 MNO 567 (Boşta) |
| 6 | İşler tab → 7 job listede | Status badge'leri renkli (open/assigned/in_progress/completed) |
| 7 | Hesap tab → Yönetim section'unda Ekibim/Filo/İşler/**Bakım Talepleri** | i18n keyleri label'a çevrilmiş (raw key görünmüyor) |
| 8 | Bakım Talepleri → Bekleyen tab "yok" + Tümü tab demo'da pre-seed approved kayıt | Empty state ✓ icon + "Bekleyen talep yok" |
| 9 | Notifications | 3 demo notification (driver_request, permission_grant, request_approved) |
| 10 | Filo Haritası → 5 marker + HQ pin | Pill arka plan vehicle rengiyle, açık renkte text siyah |

---

## 3. Auth Flow

### 3.1 Demo login
```
Welcome → Demo App → Home
```
- Demo seed yükleniyor (AsyncStorage'tan veya yeni reseed)
- 4-5 saniyelik bundle'dan sonra direkt home

### 3.2 Production login
```
Welcome → Giriş Yap → email/parola → Home
```
- Yanlış kimlik → Toast hata
- Doğru → push token registration (Android, perm pop-up)
- Profile fetch (Supabase) sonrası home

### 3.3 Register (yeni filo)
```
Welcome → Filo Başlat → form (full_name, company_name, email, password)
```
- Onaylama emaili ile aktivasyon (`requiresConfirmation: true`)
- Sonrasında giriş

### 3.4 Davet redeem
```
Welcome → Davet Kodum Var → 6-haneli kod
```
- Kod doğru → invitation lookup → kabul ekranı (full_name, password)
- Submit → role = manager veya driver olarak kayıt

### 3.5 Sign out
```
Hesap → Çıkış Yap
```
- Demo: state korur (sonraki demo girişinde restore)
- Production: token clear (`profiles.push_token=NULL`) + Supabase signOut

---

## 4. Vehicle Yönetimi

### 4.1 Liste
- Filo tab → "Yeni Araç Ekle" buton + "Haritada Gör" link
- Her kart: araç fotosu (varsa CachedImage), plate, brand+model, year, status badge

### 4.2 Yeni araç (vehicles/new)
1. **PhotoPicker:** 16:10 boş kart "Fotoğraf eklemek için dokun"
2. Tap → action sheet (Kamera / Galeri / İptal)
3. Foto seç → preview, sağ alt "Değiştir" badge, sağ üst X (remove)
4. Plaka (autoCaps) + Marka + Model + Yıl + Renk swatches (8 hex seçenek)
5. Submit:
   - Demo: data URI direkt vehicle.photo_url'a
   - Prod: Cloudinary'e signed upload → secureUrl → createVehicle
6. Toast "Araç Eklendi"
7. Filo listesine dön → yeni araç en üstte

**Doğrulanacak:** vehicles/index'te yeni kart, foto thumbnail, plaka uppercase, status default 'idle'.

### 4.3 Araç düzenle (vehicles/edit/[id])
1. vehicles/[id] sağ üst kalem ikonu (canUpdate.allowed gerek)
2. Form preload (PhotoPicker mevcut foto + alanlar dolu)
3. Foto kaldır → submit'te Cloudinary destroy + DB photo_url=null
4. Foto değiştir → eski destroy + yeni upload
5. Field değişikliği → updateVehicle

### 4.4 Vehicle detayı
- Photo hero (varsa) veya plate-derived gradient + truck ikon
- Status badge (Aktif / Boşta / Bakımda)
- "**At HQ**" CTA (canUpdate + !hasActiveJob + !is_at_hq + status≠maintenance)
- "**Bakıma Al**" CTA (vehicles.send_to_maintenance + !hasActiveJob + status≠maintenance)
- **Bakım Banner** (status='maintenance' iken):
  - "Bakımda" sarı header + tool icon
  - "SEBEP: ..."
  - "Bitiş süresi: ..." veya "Belirtilmedi"
  - Foto thumbnails (varsa, ScrollView horizontal)
  - "**Bakımdan Çıkar**" sarı buton (herkes için)
- Bilgiler card (driver, color, added_by, eklendi)
- Son işler (5 job)
- Aracı Sil (canDelete.allowed)
  - **Bu PR sonrasi:** silmeden once Cloudinary asset cleanup yapilir (photo_url + maintenance_photo_urls + ilgili maintenance_requests.photo_urls). DB row delete + best-effort destroyImage. Sentry konsoluna "destroy" hatasi gelirse fonksiyonel basari yine de kalir.

### 4.5 Vehicle Claim / Release (Arac Ustune Alma) ⭐ yeni

**Ozet:** Sofor bir araci "ustune alir" — `vehicles.current_user_id` set edilir + `vehicle_assignments` ledger'a row. Yeni bir araci ustune alirsa onceki otomatik bosalir. Aktif isi olan arac baska sofor tarafindan claim'lenemez.

#### 4.5.1 Bos arac ustune alma
1. Driver olarak vehicles/[id] ac (ornek demo: 35 MNO 567, claimable + fotosuz)
2. "Ustume Al" buton goz onunde — tap
3. Onay modal'i — "Evet, ustume al"
4. Toast "Arac size atandi"
5. **Dogrulama:** vehicles/[id] basliginda "Sizin uzerinizde" badge, "Birak" buton aktif
6. DB: `vehicles.current_user_id = caller.id`, `vehicle_assignments` yeni satir (claimed_at=now, released_at=null, reason='manual')

#### 4.5.2 Onceki araci otomatik birakma
1. Driver zaten 35 MNO 567'yi ustune almis
2. vehicles/[34 ABC 123] ac, "Ustume Al"
3. Onay → toast
4. **Dogrulama:**
   - 35 MNO 567 → current_user_id=null, banner "Sizin uzerinizde" kaybolur
   - 34 ABC 123 → current_user_id=caller, banner yeni gozukur
   - vehicle_assignments: 35 MNO 567'nin satiri released_at=now ile guncellenmis, 34 ABC 123'un yeni satiri eklenmis

#### 4.5.3 Aktif isi olan arac claim engellemesi
1. Manager olarak driver-A'ya bir iş ata, driver-A "Baslat" der → status='in_progress'
2. Driver-B olarak ayni araci vehicles/[id]'ten ac
3. "Ustume Al" buton **disabled**, alt yazi: "Arac aktif bir is icin baska soforde"
4. Eger somehow ham RPC `supabase.rpc('claim_vehicle')` cagrilirsa exception `vehicle_has_active_job_with_another_driver`

#### 4.5.4 Self-release
1. Driver kendi uzerindeki araci ac, "Birak" tap
2. Onay → toast "Arac birakildi"
3. **Dogrulama:** banner gizlenir, current_user_id=null, ledger released_at set

#### 4.5.5 Idempotency
- Ayni araci ikinci kez claim → RPC no-op, hata yok, ledger'a yeni satir yazilmaz

---

## 5. Maintenance Flow ⭐ (en kritik test serisi)

### 5.1 Talep oluşturma — auto-approve (owner)

**Ön koşul:** Demo'da owner girişi. 34 JKL 234 mevcut bakımda ise önce çıkar.

```
Filo → 34 JKL 234 → Bakımdan Çıkar → confirm → idle
   → Bakıma Al trigger görünür → tap
   → Form: sebep "Lastik degisimi" + foto picker → galeriden 1 foto seç
   → Submit
```

**Beklenen:**
- Form'da auto-approve subtitle ("Aracı doğrudan bakıma alıyorsun. Yöneticiler bilgilendirilecek.")
- Submit butonu "Bakıma Al" (auto)
- Submit sonrası:
  - Toast "Araç Bakıma Alındı"
  - Vehicle detayda banner görünür: SEBEP + 1 foto thumbnail + "Bakımdan Çıkar"
  - Vehicle status → maintenance (sarı badge)
  - Yöneticilere `maintenance_started` notification (demo'da Selin Yöneten)

### 5.2 Talep oluşturma — pending (driver-perspective, demo)

Demo'da driver perspektifi yok. Bu adım production'da test edilir:
1. Driver hesabıyla giriş
2. Vehicle detay → Bakıma Al
3. Form auto subtitle YOK, "Bakım talebi yöneticilere gönderilecek..."
4. Submit → Toast "Talep Gönderildi", status pending kalır
5. Owner notification list'inde `maintenance_requested` görür

### 5.3 Pending request approve (owner)

```
Account → Bakım Talepleri → Bekleyen tab → request kart → tap → detail
   → "Onayla" tıkla
```

**Beklenen:**
- Detail screen: "Beklemede" pill, sebep, talep eden, tarih, foto thumbnails (varsa), "Onayla" + "Reddet" butonları
- Onayla → Toast "Talep onaylandı, araç bakıma alındı"
- Vehicle.status → maintenance
- Talep eden'e `maintenance_approved` notif
- Yöneticilere `maintenance_started` notif (talep eden hariç tutulur — fix #3)

### 5.4 Pending request reject (owner)

```
... detail → "Reddet" → modal açılır
   → "Red sebebi" textarea (zorunlu)
   → Reddet
```

**Beklenen:**
- Modal'da boş kalırsa Toast "Red açıklaması zorunlu"
- Reddet sonrası: status='rejected', detail'da "Red açıklaması" kırmızı kutu
- Foto'lar Cloudinary'den destroy
- Talep eden'e `maintenance_rejected` (rejectionReason payload'da)

### 5.5 Cancel request (talep eden)

Demo'da owner talep eden kendisi olduğu için cancel butonu görünür.
```
... detail → "Talebi İptal Et" → confirm
```
- Status='cancelled', foto'lar destroy

### 5.6 Bakım çıkış

```
vehicle/[id] banner → Bakımdan Çıkar → confirm
```
- Vehicle reset (status=idle, maintenance_* NULL)
- Tüm fleet'e `maintenance_ended` notif
- Pending varsa requester'a `maintenance_pending_reminder`
- Foto'lar Cloudinary'den destroy
- Banner kaybolur, "Bakıma Al" trigger gelir

### 5.7 Aktif iş kontrolü

Vehicle assigned veya in_progress job sahipse:
- "Bakıma Al" trigger gizlenir (UI: !hasActiveJob)
- Programmatik (deep-link, race) çağrılırsa lib `MaintenanceError('active_job')` fırlatır → Toast "Aracın aktif işi var. Önce işi tamamla."

### 5.8 Auto-checkout cron (production)

Manuel test:
```sql
-- 1. Bir vehicle'ı maintenance + maintenance_until past:
UPDATE vehicles SET status='maintenance',
  maintenance_started_at = NOW() - interval '5 minutes',
  maintenance_until = NOW() - interval '1 minute',
  maintenance_reason = 'CRON-TEST'
WHERE id = '<vehicle_id>';

-- 2. RPC manuel:
SELECT maintenance_auto_checkout();
-- veya 1 dakika bekle (cron kendisi tetikler)

-- 3. Sonuç:
SELECT status, maintenance_reason FROM vehicles WHERE id = '<vehicle_id>';
-- → idle, NULL
SELECT * FROM notifications WHERE type='maintenance_overdue'
  ORDER BY created_at DESC LIMIT 5;
-- → yöneticilere overdue notification

-- 4. Cron log:
SELECT start_time, status, return_message
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname='maintenance-auto-checkout')
ORDER BY start_time DESC LIMIT 5;
```

### 5.9 Photo Authenticity Badge (Patron-only) ⭐ yeni

**Ozet:** Bakim talebi yapildiginda `photo-authenticity-check` edge function (v7) fire-and-forget tetiklenir, 3 katmanli analiz (EXIF + AI detector + content classifier) yapilir, DB row'una skorlar yazilir. Patron ekranda 4 olasi badge gorur (oncelik sirasi: wrong_content > ai_generated > exif_missing > exif_stale).

#### 5.9.1 Demo'da badge gosterimi (en hizli yol)

Demo modda login ol → Owner olarak "Bakim Talepleri" sekmesini ac. 4 hazir seed:

| Talep | Beklenen badge | Renk | Sebep (demo seed) |
|---|---|---|---|
| Lastik degisimi (pending) | **AI suphesi** | sari | suspected_ai=true |
| Klima arizasi (rejected) | **Yanlis icerik** | kirmizi | content_class='non_vehicle' (jersey) |
| Sag far (cancelled) | **EXIF metadata yok** | gri | exif_status='missing' |
| Aki testi (expired) | **EXIF tarihi eski** | gri | exif_status='stale' |

Her badge'in altinda kucuk icon + kisa metin.

#### 5.9.2 Production end-to-end (gercek edge fn)

1. Driver olarak login (real session, Cloudinary creds Supabase'de aktif)
2. Bakim talebi olustur, foto yukle (gercek arac fotosu)
3. Talep gonder → kayit basarili toast
4. **Backend behavior:**
   - INSERT maintenance_request — initial all authenticity columns NULL
   - `photo-authenticity-check` async invoke (fire-and-forget)
   - Edge fn:
     - Cloudinary'den foto indir
     - EXIF parse (DateTimeOriginal -> ne kadar eski?)
     - HF AI detector inference (umm-maybe/AI-image-detector)
     - HF content classifier (ViT veya benzeri)
   - DB UPDATE: suspected_ai, ai_score, exif_status, content_class, content_top_label, content_score, authenticity_checked_at=now
5. ~5-15 saniye sonra Owner ekrani pull-to-refresh → badge gozukur

**Dogrulama (SQL):**
```sql
SELECT id, status, suspected_ai, ai_score, exif_status, content_class,
       content_top_label, content_score, authenticity_checked_at
FROM maintenance_requests
ORDER BY requested_at DESC LIMIT 5;
```

#### 5.9.3 Edge case: HF_TOKEN missing

`HF_TOKEN` env'i Supabase secrets'ta tanimsizsa edge fn EXIF kontrolu yapar ama AI+content NULL kalir. Badge sadece exif_missing/exif_stale gosterilir. Sentry'e warn loglanir.

#### 5.9.4 Edge case: Photo not on Cloudinary (kayit silinmis)

photo_url ya 404 doner ya da bilinmeyen domain → edge fn skip + authenticity_metadata={error:'photo_unreachable'}. Patron ekraninda badge gosterilmez (defansif).

---

## 6. Job Lifecycle

### 6.1 Yeni iş (owner/manager)
```
İşler → "Yeni İş" → form
  customer_name, pickup (map picker), dropoff (map picker), driver_id (Picker)?, notes?
```
- Submit → status='open' (driver atanmamışsa) veya 'assigned' (driver varsa)

### 6.2 Driver self-request
- Driver ekranında `jobs/request.tsx` (form ile job oluşturur, source='driver_request')
- Owner notification listesinde `driver_request` görür

### 6.3 Approve / Reject driver request
- Owner job detayında "Onayla" / "Reddet" buton
- Approve → driver'a atanır, `request_approved` notif
- Reject → status='cancelled', `request_rejected` notif

### 6.4 startJob (driver)
- Driver job detayında "Başla" buton (assigned status iken)
- status='in_progress', vehicle.is_at_hq=false otomatik

### 6.5 completeJob / failJob (driver)
- "Tamamla" → completed
- "Başarısız" → reason girip failed

### 6.6 cancelJob (owner)
- Job detay → "İptal Et" → confirm
- Atanmış driver varsa `job_cancelled` notif

### 6.7 reassignJob (owner edit)
- Job edit ekranında driver Picker
- Değişirse `job_assigned` (yeni driver) notif

### 6.8 updateJob (owner edit, atanmış)
- Edit submit → `job_update` notif (changed_fields payload'da)

---

## 7. Notifications + Push

### 7.1 In-app notification
- Notifications ekranı: liste + unread badge (header)
- Tap → deep-link (job, vehicle, maintenance request)
- "Tümünü okundu işaretle" header buton

### 7.2 Push (Android) — send-push v3

**Setup gerekli:**
- `npx expo run:android` (yeni APK)
- `FCM_SERVICE_ACCOUNT_JSON` Edge Function secret VEYA Vault'ta `fcm_service_account_json` (fallback)
- `anon_key` vault secret (cron'dan push için)
- App ilk açılışta permission pop-up → İzin Ver

**v3 davranışı (önemli):**
- Lib path'leri (`jobs.ts`, `maintenance.ts`) send-push'u `persist:false` ile çağırır → notifications insert lib'de, push send-push'ta (duplicate yok).
- Doğrudan curl / cron / PowerShell çağrıları default `persist:true` → send-push hem DB'ye insert eder hem push gönderir. Her iki yolda da push **VE** app içi bildirim listesinde kayıt görünür.

**Lib path (gerçek prod akış) testi:**
1. Owner cihazıyla pending bir maintenance request oluştur (driver hesabıyla)
2. Driver cihazını arka plana al
3. Owner approve eder
4. Driver cihazda banner notification (uygulama kapalıyken bile)
5. Driver uygulamayı açıp Bildirimler ekranını çek (pull-to-refresh) → `maintenance_approved` kayıt listede

**Doğrudan send-push testi (PowerShell):**
```powershell
$payload = @{
  recipient_id = "<profile_uuid>"
  type = "maintenance_requested"
  title = "Bakım talebi"
  body = "34 ABC 123"
  data = @{ plate = "34 ABC 123"; reason = "Test" }
} | ConvertTo-Json -Compress

Invoke-RestMethod `
  -Uri "$env:SUPABASE_URL/functions/v1/send-push" `
  -Method POST `
  -Headers @{ "Authorization" = "Bearer $env:ANON"; "Content-Type" = "application/json" } `
  -Body $payload
```

Yanıtta `notification_id` döner (v3 insert sonucu); cihazda hem banner gelir hem uygulamadaki bildirim listesinde aynı kayıt görünür.

**Doğrulama:**
- `SELECT push_token FROM profiles WHERE id='<recipient>'` — token doldu mu?
- Edge Function logs (`send-push`): `{ ok:true, sent:1, notification_id:"..." }`
- `SELECT * FROM notifications WHERE id='<notification_id>'` — DB'de satır var mı?
- Telefonda Bildirimler ekranı → pull-to-refresh → kayıt listede

---

## 8. Permissions

### 8.1 Permission listesi (member detay)
```
Hesap → Yönetim → Ekibim → bir üye seç → İzinler
```
- 14 anahtar listede + kategorizasyon
- Owner için: switch'lerle override
- Manager/driver için: kendi izinlerini görür (owner override etti mi?)

### 8.2 Override
- Switch toggle → `set_permission_override` RPC
- UI'da hemen yansır (`useCan` hook re-evaluate)

### 8.3 Default davranış
| Anahtar | Owner | Manager | Driver |
|---|---|---|---|
| vehicles.view | ✓ | ✓ | ✓ |
| vehicles.create | ✓ | ✓ | ✗ |
| vehicles.update | ✓ | ✓ | ✗ |
| vehicles.delete | ✓ | ✗ | ✗ |
| jobs.view | ✓ | ✓ | ✓ |
| jobs.create | ✓ | ✓ | ✗ |
| jobs.assign | ✓ | ✓ | ✗ |
| jobs.update_any | ✓ | ✓ | ✗ |
| jobs.cancel | ✓ | ✗ | ✗ |
| members.invite | ✓ | ✓ | ✗ |
| members.remove | ✓ | ✗ | ✗ |
| reports.view | ✓ | ✓ | ✗ |
| **vehicles.send_to_maintenance** | ✓ | ✓ | ✓ |
| **vehicles.approve_maintenance** | ✓ | ✓ | ✗ |

---

## 9. Maps

### 9.1 Fleet Map
```
Home → "Haritada Gör" link veya Filo → "Haritada Gör"
```
- 5 vehicle pill + HQ + active jobs polylines
- Pill arka plan vehicle rengi
- **Beyaz/sarı/silver pill üzerinde plate + ikon SİYAH** (kontrast fix)
- Kontrast eşiği luminance > 0.6
- Refresh butonu (sağ üst)
- Legend (alt): Üs, Aktif, Boşta, Bakımda + sayılar

### 9.2 Marker tap'leri
- Vehicle pill → vehicle detay
- Pickup teardrop → openInMaps (sistem haritası)
- Dropoff teardrop → openInMaps
- HQ → openInMaps

### 9.3 JobMiniMap (job detayında)
- Pickup/dropoff teardrop + kesik kırmızı çizgi
- Vehicle pin (in_progress ise animasyonla yola oturur — 28sn cycle)
- Pin tap → openInMaps

---

## 10. Account / Settings

### 10.1 Profil
- Ad, e-posta, telefon, üyelik tarihi
- "Bilgilerimi Düzenle" → edit ekranı (avatar upload + ad + telefon)

### 10.2 Dil
- TR/EN toggle (kalıcı, AsyncStorage)

### 10.3 Owner Panel (sadece owner)
- HQ ayarları (map picker)
- Müşteri Geri Bildirim Kanalları (email/push/Telegram)
- İzinler
- Filo Sil (destructive, double-confirm)
- Bildirimler

### 10.4 Yönetim (owner+manager)
- Ekibim
- Filo
- İşler
- **Bakım Talepleri** ★

### 10.5 Yardım
- Destek (Telegram bot mesaj formu)
- Uygulama Hakkında

### 10.6 Tehlikeli Bölge
- Hesabımı Sil (owner blok yapılır — önce filo sil)
- Filo Sil (sadece owner): **bu PR sonrasi** delete_fleet RPC oncesinde
  client tarafindan tüm araclar+request fotolarinin Cloudinary asset'leri
  destroy edilir (best-effort). Sonra RPC tum org-scoped tablolari cascade
  siler.

---

## 10a. Force Update (app_versions) ⭐ yeni

**Ozet:** App startup'ta `app_versions` tablosundan platform satiri okunur, current_version semver karsilastirilir.

- `current < min_supported` → **HARD BLOCK** (full-screen modal, store linki, kapatma yok)
- `min_supported <= current < latest` → **SOFT PROMPT** (banner, dismissible)
- `current >= latest` → no-op

### 10a.1 Demo (manuel SQL)

Hard block testi:
```sql
INSERT INTO public.app_versions (platform, min_supported_version, latest_version, store_url,
  force_update_message_tr, force_update_message_en)
VALUES ('android', '9.9.9', '9.9.9', 'https://play.google.com/store/apps/details?id=com.drivermesh.android',
  'Onemli guvenlik guncellemesi gerekiyor. Hemen guncelle.',
  'Critical security update required. Update now.')
ON CONFLICT (platform) DO UPDATE
  SET min_supported_version = EXCLUDED.min_supported_version,
      latest_version = EXCLUDED.latest_version,
      force_update_message_tr = EXCLUDED.force_update_message_tr,
      force_update_message_en = EXCLUDED.force_update_message_en;
```

App'i tekrar ac → tam ekran modal, "Hemen Guncelle" butonu → store URL acilmali, "Daha sonra" yok.

### 10a.2 Soft prompt testi

```sql
UPDATE public.app_versions
   SET min_supported_version = '1.0.0',
       latest_version = '9.9.9',
       release_notes_tr = 'Bug fixes ve performans iyilestirmeleri.'
 WHERE platform = 'android';
```

App'i tekrar ac → banner gozukmeli (kapatilabilir, X ile dismiss).

### 10a.3 Geri al

```sql
UPDATE public.app_versions
   SET min_supported_version = '1.0.0',
       latest_version = '1.0.0'
 WHERE platform = 'android';
```

App'i tekrar ac → modal/banner yok, normal startup.

### 10a.4 Edge case: network kapali

App offline → app_versions fetch fail → exception yutulur, app normal acilir (defansif). Network gelince bir sonraki startup'ta yeniden denenir.

---

## 11. ADB ile Otomatik Test Pattern'leri

### 11.1 Tap koord bulma (UI dump)
```bash
adb shell uiautomator dump //sdcard/ui.xml
adb pull //sdcard/ui.xml ui.xml
grep -oE '"<Text>"[^/]+bounds="\[[0-9,]+\]\[[0-9,]+\]"' ui.xml
# Veya:
grep -B0 -A0 '<Text>' ui.xml | grep -oE 'clickable="true"[^/]+bounds="\[[0-9,]+\]\[[0-9,]+\]"'
```
Bounds `[x1,y1][x2,y2]` formatı; tap için center `((x1+x2)/2, (y1+y2)/2)`.

### 11.2 Foto picker akışı (Android 14)
```bash
adb shell input tap <photo+ button>      # Action sheet
adb shell input tap <Galeriden Seç>      # Permission pop-up
adb shell input tap <İzin Ver>           # Photo picker açılır
adb shell input tap <thumbnail center>   # Foto seçilir, form'a döner
```

### 11.3 Metin girişi
```bash
adb shell input tap <field>
adb shell input text "Mesaj%sicerik"      # boşluk %s ile
adb shell input keyevent KEYCODE_BACK     # klavye gizle
```

### 11.4 Form submit + sonuç doğrulama
```bash
adb shell input tap <submit button>
sleep 3
adb exec-out screencap -p > result.png
# Read tool ile resmi incele
```

### 11.5 Ekran zoom (foto preview)
PowerShell ile:
```powershell
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile("screen.png")
$crop = New-Object System.Drawing.Bitmap (W*scale), (H*scale)
$g = [System.Drawing.Graphics]::FromImage($crop)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$src = New-Object System.Drawing.Rectangle X, Y, W, H
$dst = New-Object System.Drawing.Rectangle 0, 0, (W*scale), (H*scale)
$g.DrawImage($img, $dst, $src, [System.Drawing.GraphicsUnit]::Pixel)
$crop.Save("zoomed.png")
```

---

## 12. Tipik Hatalar ve Çözümleri

| Hata | Çözüm |
|---|---|
| "Cannot find native module 'ExpoPushTokenManager'" | Yeni APK gerek (`npx expo run:android`); lazy import patched |
| "Attempted to navigate before mounting the Root Layout" | AuthGate fixed (`useRootNavigationState()?.key` guard) |
| "Unable to load script" | `adb reverse tcp:8081 tcp:8081` ile Metro bağlantısı |
| Tap çalışmıyor | UI dump ile gerçek bounds al; status bar / nav bar offset'ini hesapla |
| Maintenance "active_job" hata | Vehicle assigned/in_progress job'u var; UI bunu zaten gizler |
| Cloudinary "Upload preset must be specified" | Multipart form yanlış encoding (PowerShell test); curl ile multipart düzgün gönder |
| "FCM_SERVICE_ACCOUNT_JSON missing" | Supabase Edge Function Secret olarak set et veya Vault'a `fcm_service_account_json` adıyla ekle (v3 fallback) |
| Cron'dan push gitmiyor | `vault.create_secret('<anon_key>', 'anon_key')` çalıştırılmalı |
| Push geldi ama app içi Bildirimler listesi boş | Pull-to-refresh çek; `notifications` tablosunda kayıt var mı SQL ile bak. Lib path → notifications insert lib'de. Cron / doğrudan path → send-push v3 `persist:true` (default) ile insert eder; v2'de bu davranış yoktu. |
| send-push duplicate notification yaratıyor | Lib path send-push'u `persist:false` ile çağırmalı (jobs.ts, maintenance.ts). v3 default `true` olduğu için unutulursa duplicate olur. |

---

## 13. Bilinen Sınırlamalar

- **iOS push:** APNs Authentication Key + Firebase iOS app + GoogleService-Info.plist eklenmedi
- **Hierarchy Phase 2:** RLS scope filter (manager kendi şoforlerinin verisini görür) henüz uygulanmadı
- **Driver invite manager picker:** UI'da manager dropdown yok (manager_id NULL kalır)
- **send-push org-match:** Edge Function caller-recipient org match doğrulamıyor ⚠ release blocker
- **send-push deep-link tıklama:** v3 FCM data payload'a `notification_id` koyuyor ama app'in deep-link handler'ı henüz bunu yakalayıp ekrana götürmüyor
- **Multi-device push token:** son login'in device'ı kazanır; çoklu cihaz gönderim yok
- **Demo'da rol switch:** demo hep owner perspektifinden — driver/manager senaryoları prod'da test
- **DriverMesh Ride:** müşteri-side app entegrasyonu sonra

---

## 14. Test Checklist (release öncesi)

```
[ ] Smoke test (1-10) ✓
[ ] Auth: demo + login + register + redeem + signOut
[ ] Vehicle: create (foto'lu) + edit (foto change/remove) + delete (Cloudinary cleanup)
[ ] Vehicle Claim/Release: claim bos arac + onceki birakma + aktif is engellemesi + self-release
[ ] Maintenance: auto-approve + pending+approve + reject + cancel + endMaintenance
[ ] Maintenance: aktif iş varken "Bakıma Al" gizli
[ ] Photo Authenticity: 4 badge case (ai_generated, wrong_content, exif_missing, exif_stale) demo'da gozukur
[ ] Photo Authenticity prod: 1 real foto upload sonra ~10sn icinde DB'de skorlar dolar
[ ] Job: create + assign + driver start/complete/fail + cancel + reassign + update
[ ] Job: driver_request + approve/reject
[ ] Notifications: tüm tipler render + deep-link
[ ] Push (prod): permission + token DB'de + send-push v3 end-to-end (banner + app içi liste senkron)
[ ] Push: lib path (jobs/maintenance) tek kayıt yazıyor (duplicate yok)
[ ] Push: doğrudan send-push çağrısı `notification_id` döndürüyor + DB'de satır var
[ ] Cron: pg_cron logs status='succeeded'
[ ] Auto-checkout: maintenance_until past → idle + overdue notif
[ ] Force Update: hard block modal + soft prompt banner + geri al senaryosu
[ ] Maps: 5 marker + tap dispatch (vehicle/HQ/pickup/dropoff)
[ ] Maps: white pill text contrast (siyah)
[ ] Permissions: owner override member → useCan effect
[ ] i18n: TR ↔ EN toggle, raw key görünmez
[ ] Account: HQ + Feedback + Bakım Talepleri + Çıkış Yap
[ ] Account: Filo Sil (owner) — Cloudinary cleanup + RPC cascade
[ ] Demo persistence: kapat-aç sonrası state korur
[ ] Theme: dark mode tutarlı, Toast/Confirm modal styling
[ ] Native maps: iOS Apple, Android Google haritası açılır
```

---

*Doküman versiyonu: 1.2 — vehicle claim/release (§4.5), photo authenticity 4 badge (§5.9), force update (§10a) test senaryolari + Cloudinary cleanup notlari.*

---

## 15. Ride Görünürlük + Şoför Sahiplenme + Mesai Kuralları (2026-05-16)

> Bu bölüm `docs/plans/2026-05-16-ride-availability-rules.md` spec'ine bağlıdır. Implementasyon tamamlandıktan sonra bu case'ler kabul testidir. Şu an sadece happy-path (Case 1-8) `request_ride`/`cancel_ride`/`submit_rating` üzerinden çalışıyor — yeni RPC'ler (`claim_vehicle`, `set_my_status`, `is_fleet_open`) eklendikten sonra Case 9-16 koşturulur.

### Setup (her case için ortak ön durum)

- Org: `Test Lojistik` (`d1dca541-bd31-4aa2-9558-e2c50f9249b6`) — ride_enabled=true, service_area Galata 30km, operating_hours `{"tz":"Europe/Istanbul","mon"..."fri": [{"start":"08:00","end":"18:00"}],"sat":[{"start":"10:00","end":"16:00"}],"sun":[]}`.
- Owner: `Test Patron` (`32c96a66-...`).
- Driver1: `Test Şoför` (`8b9841d7-...`).
- Driver2 (yeni — Case 11/12 için): `Test Şoför 2` (yeni profile + auth.users phone signup).
- Vehicle1: `Renault Master 34 TL 1234` (`7e340e6c-...`).
- Vehicle2 (yeni — Case 11 için): `Renault Trafic 34 TL 5678`.
- Müşteri: Demo customer (`f9ee759f-...`).

### Case 9 — Araç create default = owner

| Adım | Eylem | Beklenen |
|---|---|---|
| 1 | Owner (Test Patron) fleet UI → Filo → "Araç Ekle" → form doldur → kaydet | `vehicles.current_user_id = owner_id` (Test Patron) DB'de görünür |
| 2 | `ride_search_vehicles(galata)` SQL | Yeni araç **listede YOK** (current_user.role='owner', filtre dışı) |
| 3 | Fleet vehicle listesinde araç görünür | "Üzerinde: Test Patron" badge |

**Pass kriteri:** owner üstündeki araç ride'da gizli, fleet'te görünür.

---

### Case 10 — Driver bir aracı claim eder

| Adım | Eylem | Beklenen |
|---|---|---|
| 1 | Driver Test Şoför oturum aç, status='active' set | `profiles.status='active'` |
| 2 | Vehicle list'te owner üstündeki Renault Master için "Üzerine Al" tıkla | `claim_vehicle('7e340e6c-...')` RPC çağrısı → success |
| 3 | DB | `vehicles.current_user_id = test_sofor.id` |
| 4 | Ride app vehicles tab refresh | Renault Master **listede görünür** (driver üstünde, active, mesai içi) |
| 5 | Fleet'te vehicle kartı | "Üzerinde: Test Şoför" |

**Pass kriteri:** claim sonrası ride'da görünür hale geçiş.

---

### Case 11 — Bir şoför birden fazla araç üstüne alabilir

| Adım | Eylem | Beklenen |
|---|---|---|
| 1 | Owner ikinci araç ekler: Renault Trafic 34 TL 5678 | `current_user_id = owner` |
| 2 | Test Şoför `claim_vehicle('5678-id')` | success |
| 3 | DB query | `SELECT count(*) FROM vehicles WHERE current_user_id = test_sofor` → 2 |
| 4 | Ride vehicles tab | Her iki araç da listede görünür (status='active' yeterli) |

**Pass kriteri:** 1 şoför → N araç ilişkisi serbest, listede her ikisi de var.

---

### Case 12 — Aktif ride iken claim_vehicle reddedilir (T8)

| Adım | Eylem | Beklenen |
|---|---|---|
| 1 | Test Şoför Renault Master'a sahip, müşteri çağrı yaptı (`ride.status='assigned'`) | Araç ride'a kilitli |
| 2 | İkinci driver Test Şoför 2 `claim_vehicle('7e340e6c-...')` | RPC `T8: vehicle on active ride` hatası |
| 3 | DB | `vehicles.current_user_id` değişmedi (hala Test Şoför) |
| 4 | Ride tamamlanır (`status='completed'`) | Kilit kalkar |
| 5 | Test Şoför 2 tekrar claim | success |

**Pass kriteri:** Aktif state'lerde (`searching/assigned/driver_arrived/in_progress`) claim_vehicle reject. Completed/cancelled sonrası serbest.

---

### Case 13 — Bakımdaki araç claim edilemez (T9)

| Adım | Eylem | Beklenen |
|---|---|---|
| 1 | Owner Renault Master'ı bakıma alır (`maintenance_started_at=now()`) | DB OK |
| 2 | Test Şoför `claim_vehicle` | `T9: vehicle in maintenance` |
| 3 | Ride vehicles tab | Araç listede yok (mevcut maintenance filtresi) |
| 4 | Bakım biter (`maintenance_started_at=NULL`) | Tekrar claim edilebilir + listede görünür |

---

### Case 14 — Profile status filter: break/off_duty araç listeden düşürür

| Adım | Eylem | Beklenen |
|---|---|---|
| 1 | Test Şoför `set_my_status('active')` + Renault Master üstünde | Ride'da görünür |
| 2 | Test Şoför `set_my_status('break')` | 3-6sn içinde ride listesinden DÜŞER |
| 3 | Test Şoför `set_my_status('off_duty')` | Liste boş kalır (Galata'da başka driver yoksa) |
| 4 | Test Şoför `set_my_status('active')` | Tekrar görünür |
| 5 | Active ride başlat → manuel `set_my_status('break')` deneme | `T10: on_trip cannot be manually overridden` (eğer trip otomatik on_trip set ettiyse) |

**Pass kriteri:** Manuel status değişimi anında (max 1 polling cycle) ride listesini etkiler. on_trip manuel override edilemez.

---

### Case 15 — Operating hours filter

| Adım | Eylem | Beklenen |
|---|---|---|
| 1 | fleets_visibility.operating_hours pazartesi 08:00–18:00 set | OK |
| 2 | DB clock'u 07:30 simüle (`SELECT is_fleet_open(org_id, '2026-05-18 07:30+03'::timestamptz)`) | `false` |
| 3 | Aynı saatte `ride_search_vehicles` | Test Lojistik araçları listede YOK |
| 4 | 09:00'a simüle et | `true` + araçlar görünür |
| 5 | Pazar günü `sun: []` | Liste boş tüm gün |
| 6 | `operating_hours IS NULL` | 7/24 açık (geriye uyumluluk) |

**Pass kriteri:** Filo mesai dışında ride listesinde hiç görünmez.

---

### Case 16 — Fleet UI: Status seçici

| Adım | Eylem | Beklenen |
|---|---|---|
| 1 | Test Şoför fleet anasayfada | Dil seçici (TR/EN) altında status pill 🟢 "Aktif" |
| 2 | Pille tıkla | Bottom sheet açılır: Aktif / Mola / Mesai Dışı / Müsait Değil seçenekleri |
| 3 | "Mola" seç | Pill 🟡 "Mola" + `profiles.status='break'` + status_updated_at güncellenir |
| 4 | Ride app paralel kontrol | Driver'ın aracı 3-6sn içinde müşteri listesinden düşer |
| 5 | Aktif ride başla (on_trip otomatik) | Pill 🔵 "Yolculukta", tıklanabilir değil (disabled) |
| 6 | Ride biter | Pill pre-trip status'a döner (varsa break → break, yoksa active) |

**Pass kriteri:** UI ↔ DB ↔ ride app görünürlük üçü tutarlı.

---

### Case 17 — Vehicle status counter yeniden hesaplama

Anasayfa "X aktif · Y müsait · Z boşta · W bakımda" formatı:
- **aktif:** active ride'da en az 1 araç (`vehicle_id IN (SELECT vehicle_id FROM ride_requests WHERE status IN active)`).
- **müsait:** driver üstünde + driver.status='active' + bakım dışı + ride'a girmemiş.
- **boşta:** owner üstünde, ya da driver üstünde ama status active değil.
- **bakımda:** maintenance_started_at NOT NULL.

| Adım | Eylem | Beklenen |
|---|---|---|
| 1 | 4 araç: 1 active ride'da, 1 driver+active, 1 owner üstünde, 1 bakımda | "1 aktif · 1 müsait · 1 boşta · 1 bakımda" |
| 2 | Driver mola | "1 aktif · 0 müsait · 2 boşta · 1 bakımda" |

---

## 16. Yeni RPC test kapsamı (DB seviyesinde)

Her yeni RPC için en az 3 unit test (Supabase MCP execute_sql):

### `claim_vehicle(p_vehicle_id)`
1. Happy: aynı org, idle vehicle → success, current_user_id update.
2. T8: aktif ride'lı vehicle → reject.
3. T9: maintenance vehicle → reject.
4. T3: farklı org'un aracı → reject.
5. Yeniden claim: zaten benim ise no-op (success, idempotent).

### `set_my_status(p_status)`
1. Happy: active → break geçiş, status_updated_at güncellenir.
2. T10: aktif ride iken active → break (on_trip override) → reject.
3. on_trip manuel set → reject (sadece sistem set edebilir).

### `is_fleet_open(p_org_id, p_at)`
1. Mesai içi → true.
2. Mesai dışı → false.
3. NULL operating_hours → true (geriye uyumluluk).
4. Pazar boş array → false her saat.

### `ride_search_vehicles` regression
1. Driver active + claim + mesai içi → görünür.
2. Driver break → gizli.
3. Owner claim → gizli (role filter).
4. Mesai dışı → tüm filo gizli.
5. Vehicle aktif ride'da → gizli.

---

*Doküman versiyonu: 1.3 — ride availability & user status & operating hours test senaryoları (§15-16).*
