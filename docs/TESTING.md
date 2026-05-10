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

### 7.2 Push (Android)
**Setup gerekli:**
- `npx expo run:android` (yeni APK)
- `FCM_SERVICE_ACCOUNT_JSON` Edge Function secret
- `anon_key` vault secret (cron'dan push için)
- App ilk açılışta permission pop-up → İzin Ver

**Test:**
1. Owner cihazıyla pending bir maintenance request oluştur (driver'dan)
2. Driver cihazını arka plana al
3. Owner approve eder
4. Driver cihazda banner notification (uygulama kapalıyken bile)

**Doğrulama:**
- `SELECT push_token FROM profiles WHERE id='<recipient>'` — token doldu mu?
- Edge Function logs (`send-push`): "ok: true, sent: 1"

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
| "FCM_SERVICE_ACCOUNT_JSON missing" | Supabase Edge Function Secret olarak set et |
| Cron'dan push gitmiyor | `vault.create_secret('<anon_key>', 'anon_key')` çalıştırılmalı |

---

## 13. Bilinen Sınırlamalar

- **iOS push:** APNs Authentication Key + Firebase iOS app + GoogleService-Info.plist eklenmedi
- **Hierarchy Phase 2:** RLS scope filter (manager kendi şoforlerinin verisini görür) henüz uygulanmadı
- **Driver invite manager picker:** UI'da manager dropdown yok (manager_id NULL kalır)
- **send-push org-match:** Edge Function caller-recipient org match doğrulamıyor
- **Multi-device push token:** son login'in device'ı kazanır; çoklu cihaz gönderim yok
- **Demo'da rol switch:** demo hep owner perspektifinden — driver/manager senaryoları prod'da test
- **DriverMesh Ride:** müşteri-side app entegrasyonu sonra

---

## 14. Test Checklist (release öncesi)

```
[ ] Smoke test (1-10) ✓
[ ] Auth: demo + login + register + redeem + signOut
[ ] Vehicle: create (foto'lu) + edit (foto change/remove) + delete
[ ] Maintenance: auto-approve + pending+approve + reject + cancel + endMaintenance
[ ] Maintenance: aktif iş varken "Bakıma Al" gizli
[ ] Job: create + assign + driver start/complete/fail + cancel + reassign + update
[ ] Job: driver_request + approve/reject
[ ] Notifications: tüm tipler render + deep-link
[ ] Push (prod): permission + token DB'de + send-push end-to-end
[ ] Cron: pg_cron logs status='succeeded'
[ ] Auto-checkout: maintenance_until past → idle + overdue notif
[ ] Maps: 5 marker + tap dispatch (vehicle/HQ/pickup/dropoff)
[ ] Maps: white pill text contrast (siyah)
[ ] Permissions: owner override member → useCan effect
[ ] i18n: TR ↔ EN toggle, raw key görünmez
[ ] Account: HQ + Feedback + Bakım Talepleri + Çıkış Yap
[ ] Demo persistence: kapat-aç sonrası state korur
[ ] Theme: dark mode tutarlı, Toast/Confirm modal styling
[ ] Native maps: iOS Apple, Android Google haritası açılır
```

---

*Doküman versiyonu: 1.0 — kapsamlı test rehberi.*
