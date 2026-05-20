# DriverMesh — Full Test Rehberi (Tabula Rasa, v2.0)

> **Amaç:** Uygulamayı ilk defa görüyor gibi davranan üç rol (Ayşe-Patron, Mehmet-Şoför, Selin-Müşteri) ile fleet (driver/filo) ve ride (customer) uygulamalarını **baştan sona** doğrulamak.
>
> **Yöntem:** Veritabanı her test koşusundan **önce** §0'daki SQL ile sıfırlanır (kullanıcı verisi tamamen silinir, sistem konfigürasyonu korunur). Üç rolün adımları **tek operatör (Claude Code)** tarafından otonom çalıştırılır:
> - **Fleet (Android cihaz)** — `adb shell input tap/text/keyevent` ile tap & form, `adb logcat` ile error capture, `screencap` ile ekran kanıtı. Ayşe (owner) ve Mehmet (driver) hesapları **aynı cihazda** sırayla giriş yapar (logout/login).
> - **Ride (web preview, http://localhost:8082)** — `mcp__Claude_Preview__preview_click/fill/snapshot/screenshot` ile Selin akışı.
> - **DB doğrulama** — `mcp__supabase__execute_sql` ile her senaryo sonunda beklenen sayım/satırlar kontrol edilir.
> - **Sentry / advisor** — her senaryo sonunda `get_advisors` delta + Sentry event sayımı raporlanır.
>
> Her senaryo: beklenen davranış + Pass/Fail kutu + gerçekte gözlenen + bug raporu kanalı. Bir senaryo Fail olursa diğerleri durdurulmaz, raporda işaretlenir.
>
> **Notes:** Bu otonom yöntem React Native Web Pressable race'i gibi "gerçek parmak dokunuşu" gerektiren edge case'leri yakalamayabilir. O tür durumlarda manuel test bayrağı düşülür ve operatör (insan) müdahil olur.
>
> **Doküman versiyonu:** 2.0 — tabula rasa playbook. Önceki sürüm 1.4 (fleet+ride cross-app + perf/güvenlik) arşiv halinde git history'de (`08e3ffd` öncesi commit'ler).

## İçindekiler

- §0 [Pre-Test Reset (her koşudan ÖNCE çalıştırılacak SQL)](#0-pre-test-reset)
- §1 [Kapsam ve Aktörler](#1-kapsam-ve-aktörler)
- §2 [Hazırlık Listesi](#2-hazırlık-listesi)
- §3 [Senaryo 1 — Filo Başlatma (Owner ilk kayıt)](#3-senaryo-1--filo-başlatma)
- §4 [Senaryo 2 — Şoför Daveti + Kabul](#4-senaryo-2--şoför-daveti-kabul)
- §5 [Senaryo 3 — Filo Yapılandırma (araç, ride_enabled, status)](#5-senaryo-3--filo-yapılandırma)
- §6 [Senaryo 4 — Müşteri Kaydı (ride web)](#6-senaryo-4--müşteri-kaydı)
- §7 [Senaryo 5 — Cross-app E2E (çağır → vardım → başlat → tamamla → iki yönlü rating)](#7-senaryo-5--cross-app-e2e)
- §8 [Senaryo 6 — Edge Cases (idempotency, T-kuralları, cancel)](#8-senaryo-6--edge-cases)
- §9 [Senaryo 7 — Push Notification Deep-Link](#9-senaryo-7--push-notification-deep-link)
- §10 [Senaryo 8 — Force Update (cross-app isolation)](#10-senaryo-8--force-update)
- §11 [Performans + Güvenlik Kontrol Noktaları](#11-performans--güvenlik-kontrol-noktaları)
- §12 [Bug Bildirim Şablonu](#12-bug-bildirim-şablonu)
- §13 [Final Test Raporu Şablonu](#13-final-test-raporu-şablonu)
- §14 [Referans: Reset SQL Detayı + Sistem Tablo Koruma Listesi](#14-referans-reset-sql-detayı--sistem-tablo-koruma-listesi)
- §15 [Bilinen Limitasyonlar + V2 Bekleyenler](#15-bilinen-limitasyonlar--v2-bekleyenler)
- §16 [Otomatik Unit Test (Jest)](#16-otomatik-unit-test-jest)

---

## 0. Pre-Test Reset

> **ÖNEMLİ:** Bu SQL **her tam test koşusundan önce** çalıştırılır. Veritabanını kullanıcı verisinden tamamen temizler. Sistem konfigürasyonu (force update sürümleri, permission catalog, default role permissions, fare config, PostGIS SRID) DOKUNULMAZ. Şema, RPC, trigger, RLS politikası, index, enum — hepsi olduğu gibi kalır.

### 0.1 SQL

```sql
-- Public schema (fleet + ride app data)
TRUNCATE TABLE
  public.ratings,
  public.payments,
  public.ride_offers,
  public.ride_requests,
  public.maintenance_requests,
  public.notifications,
  public.customer_notifications,
  public.permission_overrides,
  public.vehicle_assignments,
  public.invitations,
  public.jobs,
  public.vehicles,
  public.fleets_visibility,
  public.customers,
  public.profiles,
  public.organizations
RESTART IDENTITY CASCADE;

-- filoLocal schema (legacy/POC, audit-discovered; tutmak istenirse bu blok atlanır)
TRUNCATE TABLE
  "filoLocal".users,
  "filoLocal".company_members,
  "filoLocal".legal_consents,
  "filoLocal".invitations,
  "filoLocal".vehicle_assignments,
  "filoLocal".vehicle_handovers,
  "filoLocal".jobs,
  "filoLocal".user_notification_prefs,
  "filoLocal".notifications,
  "filoLocal".chat_thread_members,
  "filoLocal".chat_messages,
  "filoLocal".audit_logs,
  "filoLocal".message_receipts,
  "filoLocal".driver_documents,
  "filoLocal".feedback,
  "filoLocal".leave_requests,
  "filoLocal".driver_statuses,
  "filoLocal".companies,
  "filoLocal".shifts,
  "filoLocal".shift_logs,
  "filoLocal".device_tokens,
  "filoLocal".escalations,
  "filoLocal".incidents,
  "filoLocal".garages,
  "filoLocal".vehicles,
  "filoLocal".vehicle_maintenance,
  "filoLocal".chat_threads
RESTART IDENTITY CASCADE;

-- auth.users (tüm test hesapları)
DELETE FROM auth.users;
```

### 0.2 Çalıştırma yöntemleri

1. **Supabase Dashboard** — SQL Editor → SQL'i yapıştır → **Run**.
2. **Claude Code MCP** — `mcp__supabase__apply_migration` (name: `truncate_test_data_for_fresh_e2e`) → auto-mode classifier'ı "destructive" diye onay isteyecek → **Approve**.
3. **CLI** — `psql $SUPABASE_DB_URL -f reset.sql` (service-role connection string ile).

### 0.3 Verifikasyon

```sql
SELECT
  (SELECT COUNT(*) FROM public.organizations)             AS pub_orgs,
  (SELECT COUNT(*) FROM public.profiles)                  AS pub_profiles,
  (SELECT COUNT(*) FROM public.customers)                 AS pub_customers,
  (SELECT COUNT(*) FROM public.vehicles)                  AS pub_vehicles,
  (SELECT COUNT(*) FROM public.ride_requests)             AS pub_rides,
  (SELECT COUNT(*) FROM "filoLocal".users)                AS filo_users,
  (SELECT COUNT(*) FROM auth.users)                       AS auth_users,
  (SELECT COUNT(*) FROM public.app_versions)              AS sys_app_versions,    -- 4 (KORUNDU)
  (SELECT COUNT(*) FROM public.permission_keys)           AS sys_perm_keys,       -- 16
  (SELECT COUNT(*) FROM public.role_default_permissions)  AS sys_role_perms,      -- 48
  (SELECT COUNT(*) FROM public.fare_config)               AS sys_fare_config;     -- 1
```

**Beklenen:** Tüm `pub_*` / `filo_*` / `auth_users` = 0. `sys_*` korunmuş sayılarda (4, 16, 48, 1).

### 0.4 Korunan sistem tabloları (DOKUNULMAZ)

| Tablo | Amaç | Tahmini satır |
|---|---|---|
| `public.app_versions` | Force update sürüm matrisi (fleet+ride × android+ios) | 4 |
| `public.permission_keys` | Permission catalog (action+resource çiftleri) | 16 |
| `public.role_default_permissions` | Owner/manager/driver varsayılan yetkileri | 48 |
| `public.fare_config` | Ride fiyatlandırma katsayıları | 1 |
| `public.spatial_ref_sys` | PostGIS SRID kataloğu (geo projections) | ~8500 |
| `auth.identities`, `auth.refresh_tokens` vb. | Supabase auth altyapısı | (CASCADE ile users silince temizlenir) |

Bu tabloların hiçbiri test sırasında değişmez. Eğer bir testte değişirlerse → bug.

---

## 1. Kapsam ve Aktörler

### 1.1 Aktörler

| Rol | Adı | Cihaz/Kanal | Otomasyon kanalı | Hesap (test sırasında yaratılır) |
|---|---|---|---|---|
| **A1 — Filo Patronu** | *Ayşe Demir* | Android cihaz, fleet app | `adb` (input tap/text, logcat, screencap) | `ayse+test@drivermesh.local` / `Test1234!` |
| **A2 — Şoför** | *Mehmet Yıldız* | Aynı Android cihaz (Ayşe sign-out → davet redeem) | `adb` (aynı) | `mehmet+test@drivermesh.local` / `Test1234!` |
| **B — Müşteri** | *Selin Yıldız* | Bilgisayar, Chrome (preview server) | `mcp__Claude_Preview__preview_*` (click/fill/snapshot/screenshot) | Phone signup `+905551234567` (devSignIn fallback) |

**Otonom yürütme akışı:**
- **Fleet:** Cihaz USB ile bağlı (`adb devices` → `device`). Operatör (Claude) `adb shell input tap X Y` ile butonlara basar, `adb shell input text "..."` ile form doldurur, `adb logcat -d` ile post-action error yakalar.
- **Ride:** Web preview server `cd ride && npx expo start --web --port 8082` ile başlatılır, `preview_click '[data-testid="..."]'` veya CSS selector ile interact edilir. React Native Web `Pressable` event'lerinde nadiren race olur → preview_eval ile direkt handler çağrısı fallback'i kullanılır.
- **DB:** Her adım sonrası `execute_sql` ile organizations / profiles / customers / ride_requests / ratings sayım + satır kontrolü.
- **Manuel müdahale**: yalnız adb input'un yetmediği yerlerde (örn. cihaz-spesifik MIUI popup'ı, biyometrik prompt) tester insan operatör çağrılır. Bu noktalarda **Senaryo[N].M** etiketiyle bayrak düşülür.

### 1.2 Senaryo akışı

```
0. RESET ─────────────────────────────────────────────────
1. Ayşe: Filo Başlat (signup)
2. Ayşe: Mehmet'e davet gönder
3. Mehmet: Davet kodunu redeem (Ayşe çıkış → Mehmet giriş)
4. Ayşe: 2 araç ekle (Renault Master, Mercedes Vito), ride_enabled aç
5. Mehmet: status "Aktif", her iki aracı sırayla üstüne al
6. Selin: ride.web aç, phone signup, profile setup
7. Selin: araç listesi → çağır
8. Mehmet: aktif yolculuk banner → vardım → başlat → tamamla
9. Mehmet (fleet) + Selin (ride): iki yönlü rating
10. Edge cases (idempotency, T-kuralları, cancel'lar, force update)
```

Her senaryoda **gözlenen davranış** + Pass/Fail kutuları + log/sentry event referansı kayıt altına alınır.

### 1.3 Süre tahmini

- Mutlu yol (S1–S5): ~25 dakika
- Edge cases (S6): +20 dakika
- Push deep-link + force update (S7–S8): +15 dakika
- Performans/güvenlik kontrol (§11): +10 dakika

**Toplam:** ~70 dakika full pass.

---

## 2. Hazırlık Listesi

### 2.1 Tester A (Fleet, Android)

- [ ] USB ile Android cihaz bağlı: `adb devices` → `device` görür.
- [ ] Fleet debug APK kurulu (`com.drivermesh.android`). Yoksa: `cd fleet && npx expo run:android` (ANDROID_HOME=/c/android-sdk PATH=…/platform-tools:$PATH).
- [ ] Metro dev server arka planda: `cd fleet && npx expo start --dev-client`.
- [ ] Cihaz Wi-Fi açık, Supabase erişimi var.
- [ ] Adb logcat tail hazır: `adb -s <id> logcat -c` (clear), test sırasında `adb -s <id> logcat AndroidRuntime:E ReactNativeJS:E *:S` ile error filtrele.

### 2.2 Tester B (Ride, Web)

- [ ] Chrome incognito (eski cache temiz).
- [ ] Ride dev server çalışır: `cd ride && npx expo start --web --port 8082`.
- [ ] http://localhost:8082 açık, DevTools Console + Network sekmeleri görünür.
- [ ] Konum izni: bilgisayar geolocation'ı reddederse `useGeolocation` `__DEV__` ile Galata mock (41.0256, 28.9742) düşer; tarayıcıdan reddet **veya** kabul et (bilgilendir).

### 2.3 DB Reset

- [ ] §0 SQL çalıştırıldı.
- [ ] §0.3 verifikasyon: tüm user-data tabloları 0, sistem tabloları korunmuş.
- [ ] Sentry, advisor snapshot baseline alındı (§11.1).

### 2.4 Memo + bug raporu defteri

- [ ] Pass/Fail kutuları için A4 + kalem, ya da bir markdown çalışma kâğıdı.
- [ ] Telefon kamerası (gerekirse cihaz ekran kaydı).

---

## 3. Senaryo 1 — Filo Başlatma

**Aktör:** Ayşe (Tester A) | **Süre:** ~5 dk

| # | Adım | Beklenen | ✅/❌ | Not |
|---|---|---|---|---|
| 1.1 | Fleet app'i aç (cold start) | Welcome ekranı: logo + tagline + "Demo App" + "Giriş Yap" + "Filo Başlat" + "Davet Kodum Var" | ☐ | |
| 1.2 | "Filo Başlat" butonuna bas | Register formu açılır: Ad Soyad / Firma Adı / Email / Parola alanları | ☐ | |
| 1.3 | Formu doldur: "Ayşe Demir" / "Demir Lojistik" / `ayse+test@drivermesh.local` / `Test1234!` → submit | "Kayıt başarılı, mail kutunu kontrol et" toast'u VEYA otomatik login (Supabase email confirmation kapalıysa) | ☐ | |
| 1.4 | Email confirmation (varsa) | Mail kutusunda "Drivermesh Confirm" → link → tarayıcıda "Email confirmed" sayfası | ☐ | dev'de Supabase confirm kapalı olabilir |
| 1.5 | Anasayfa açılır | Header: avatar (initials), "İyi Günler, / Ayşe", bildirim ikonu (60×60). Status pill "Mesai Dışı" full-width, bildirim ikonu altında. "CANLI · Filo Haritasını Görüntüle" linki. Filo Ritmi (0 aktif · 0 boşta), Hızlı Aksiyon grid (Yeni İş, Kişi Ekle, Araç Ekle, Raporlar) | ☐ | |
| 1.6 | DB doğrulama (SQL):<br>`SELECT id, name FROM public.organizations;`<br>`SELECT id, full_name, role FROM public.profiles;`<br>`SELECT COUNT(*) FROM public.fleets_visibility;` | 1 organization (Demir Lojistik), 1 profile (Ayşe, role=owner), 1 fleets_visibility (org_id=org, ride_enabled=false default) | ☐ | trigger `on_auth_fleet_owner_signup` çalıştı doğrulaması |
| 1.7 | Sentry dashboard kontrol | Yeni event YOK (mutlu yol, exception fırlatmadı) | ☐ | |

**Beklenen bug noktaları:**
- Email confirmation Supabase'de açık ama dev'de mail göndermiyor olabilir → adım 1.4'te kullanıcı sıkışır. Workaround: SQL `UPDATE auth.users SET email_confirmed_at = now() WHERE email = '...';`.
- Welcome'da "Demo App" tap'i bu testte gerek yok; sadece "Filo Başlat" yolundayız.

---

## 4. Senaryo 2 — Şoför Daveti + Kabul

**Aktörler:** Ayşe → Mehmet (Tester A, sırayla logout/login) | **Süre:** ~6 dk

### 4.1 Ayşe davet gönderir

| # | Adım | Beklenen | ✅/❌ | Not |
|---|---|---|---|---|
| 2.1 | Anasayfa → "Kişi Ekle" Hızlı Aksiyon | Team / Ekibim ekranı: Üyeler (1 — Ayşe owner) + Bekleyen Davetler (0) + "Yeni Davet" CTA | ☐ | |
| 2.2 | "Yeni Davet" → form | Email + role (manager/driver radio) + "Davet Et" | ☐ | |
| 2.3 | `mehmet+test@drivermesh.local` + role=driver → submit | "Davet oluşturuldu" toast + 6 haneli kod ekranda (örn. `K3M7P2`) | ☐ | kodu kaydet — Tester A için sonraki adım |
| 2.4 | DB doğrulama:<br>`SELECT id, code, email, role, organization_id, status, expires_at FROM public.invitations;` | 1 invitation row: email=mehmet+test, role=driver, status=pending, expires_at +7 gün | ☐ | |

### 4.2 Mehmet redeem

| # | Adım | Beklenen | ✅/❌ | Not |
|---|---|---|---|---|
| 2.5 | Ayşe → Hesap → "Çıkış Yap" → confirm | Welcome ekranına döner | ☐ | session signOut, AuthGate redirect |
| 2.6 | Welcome → "Davet Kodum Var" | 6-haneli kod input ekranı | ☐ | |
| 2.7 | Kodu gir (`K3M7P2` örnek) → submit | "Davet bulundu" → Profile setup formu: Ad Soyad + Email + Parola | ☐ | invitation.email ile ilk doldurulmuş gelir |
| 2.8 | "Mehmet Yıldız" / `mehmet+test@drivermesh.local` / `Test1234!` → kabul | Otomatik login → Anasayfa (driver perspektifinden) | ☐ | |
| 2.9 | Anasayfa header | "İyi Günler, Mehmet" + status pill "Mesai Dışı" + driver bottom nav (İşler/Filo/Hesap; manager-only menüler gizli) | ☐ | |
| 2.10 | DB:<br>`SELECT id, full_name, role, organization_id FROM public.profiles;`<br>`SELECT status FROM public.invitations;` | 2 profile (Ayşe owner + Mehmet driver, aynı org), invitation.status='accepted' | ☐ | |

---

## 5. Senaryo 3 — Filo Yapılandırma

**Aktör:** Ayşe (Tester A, Mehmet → çıkış → Ayşe yeniden giriş) | **Süre:** ~5 dk

### 5.1 Ayşe yeniden giriş

| # | Adım | Beklenen | ✅/❌ |
|---|---|---|---|
| 3.1 | Mehmet → Hesap → Çıkış → Welcome → "Giriş Yap" → `ayse+test@drivermesh.local` + `Test1234!` | Anasayfa (owner) | ☐ |

### 5.2 Araç ekle (×2)

| # | Adım | Beklenen | ✅/❌ |
|---|---|---|---|
| 3.2 | Filo tab veya "Araç Ekle" Hızlı Aksiyon | Vehicles index, "Yeni Araç" CTA | ☐ |
| 3.3 | Form: Plaka `34 TST 001` / Marka `Renault` / Model `Master` / Yıl `2024` / Renk seç | "Araç eklendi" toast, listeye düşer | ☐ |
| 3.4 | Trigger: `vehicles_set_default_owner` — yeni araç `current_user_id = auth.uid()` (Ayşe) | DB: `SELECT plate, current_user_id FROM public.vehicles;` → Ayşe id | ☐ |
| 3.5 | Tekrarla: `34 TST 002` / `Mercedes` / `Vito` / 2024 | 2 araç listede, ikisi de Ayşe üzerinde | ☐ |

### 5.3 Ride hizmetini aç

| # | Adım | Beklenen | ✅/❌ |
|---|---|---|---|
| 3.6 | Hesap → "Yolcu Hizmeti" | Toggle ekranı: `ride_enabled` switch off | ☐ |
| 3.7 | Switch'i aç | "Filonuz müşterilere açık" status mesajı; DB: `fleets_visibility.ride_enabled = true` | ☐ |
| 3.8 | Operating hours (varsa UI) | NULL → 7/24 default; UI yoksa SQL ile patch:<br>`UPDATE public.fleets_visibility SET operating_hours = NULL;` | ☐ |
| 3.9 | Service area | UI yoksa SQL ile Galata 30km set:<br>`UPDATE public.fleets_visibility SET service_area = ST_Buffer(ST_SetSRID(ST_MakePoint(28.9742, 41.0256), 4326)::geography, 30000)::geography;` | ☐ |

### 5.4 Mehmet aktif + araç sahiplenir

| # | Adım | Beklenen | ✅/❌ |
|---|---|---|---|
| 3.10 | Ayşe çıkış → Mehmet giriş | Anasayfa (driver) | ☐ |
| 3.11 | Status pill → "Aktif" | `set_my_status('active')` RPC → DB: `profiles.status = 'active'` | ☐ |
| 3.12 | Mehmet bir aracı üstüne alır — Vehicles tab → bir araç → "Üzerine Al" (UI gap: yoksa SQL):<br>`SELECT public.claim_vehicle_for_ride('<vehicle_uuid>');` | DB: `vehicles.current_user_id = Mehmet`, toast "Araç üzerine alındı" | ☐ |
| 3.13 | DB final:<br>`SELECT v.plate, v.current_user_id, p.full_name, p.status FROM public.vehicles v JOIN public.profiles p ON p.id = v.current_user_id;` | Vito → Mehmet (active), Master → Ayşe (off_duty default veya non-active) | ☐ |

---

## 6. Senaryo 4 — Müşteri Kaydı

**Aktör:** Selin (Tester B) | **Süre:** ~3 dk

| # | Adım | Beklenen | ✅/❌ |
|---|---|---|---|
| 4.1 | http://localhost:8082 incognito aç | Splash → Welcome (drivermesh-splash bg) | ☐ |
| 4.2 | Welcome → "Devam et" veya phone screen | Telefon numarası input + "Devam" | ☐ |
| 4.3 | `+90 555 123 45 67` gir → submit | **`__DEV__`** modunda devSignIn fallback: doğrudan login (Twilio kapalı). Production'da OTP ekranına atar. | ☐ |
| 4.4 | Profile setup ekranı (yeni customer) | "Ad Soyad" input → "Selin Yıldız" → Kaydet | ☐ |
| 4.5 | Konum izni (browser) | "Konumunuza izin verilsin mi?" → Reddet veya Kabul; **reddedersen** `useGeolocation` `__DEV__` ile Galata mock (41.0256, 28.9742) düşer | ☐ |
| 4.6 | Anasayfa açılır | Header: "İyi günler, Selin" + İstanbul chip + "Anasayfa" / "Hesap" bottom tab + sağ alt 64px FAB refresh | ☐ |
| 4.7 | Vehicles listesi | "Bu çevrede 1 araç" (Mehmet'in üstüne aldığı Vito) — `34 TST 002`, Mercedes Vito, Beyaz, 2024, "Şofor Mehmet", "<1m" mesafe (Galata pickup'a göre) | ☐ |
| 4.8 | DB doğrulama:<br>`SELECT id, full_name, phone, auth_user_id FROM public.customers;` | 1 customer row: Selin, +905551234567 | ☐ |

**Beklenen bug noktaları:**
- React Native Web Pressable race: "Devam" tap'i bazen tetiklenmez → preview_eval fallback. Bu V1 sınırı, RN Web 0.22+ ile düzelir.
- "Şofor" yazısı i18n key'i — eğer raw key `vehicle.driverPrefix` görünüyorsa lokal eksik.

---

## 7. Senaryo 5 — Cross-app E2E

**Aktörler:** Selin (Tester B) + Mehmet (Tester A) | **Süre:** ~8 dk | **En kritik test akışı**

| # | Adım | Aktör | Beklenen | ✅/❌ |
|---|---|---|---|---|
| 5.1 | Vehicle kartı tap (Vito) | Selin (web) | Call modal: driver adı + araç plate + fare estimate placeholder | ☐ |
| 5.2 | "Çağır" tap | Selin | `request_ride(p_vehicle_id, p_pickup_lng, p_pickup_lat, p_pickup_address)` RPC → active ride banner | ☐ |
| 5.3 | DB doğrulama:<br>`SELECT id, status, customer_id, driver_id, vehicle_id, assigned_at FROM public.ride_requests;` | — | 1 ride: status='assigned', driver=Mehmet, vehicle=Vito | ☐ |
| 5.4 | "Aktif yolculuk var" banner anasayfada | Mehmet (cihaz) | `useDriverActiveRide` polling 3s içinde yakalar, banner status pill altında | ☐ |
| 5.5 | Banner tap → driver-ride ekranı | Mehmet | Status "Yolcuya doğru" + "Müşteriye Vardım" CTA | ☐ |
| 5.6 | "Müşteriye Vardım" tap | Mehmet | `driver_arrived` RPC → status='driver_arrived', `arrived_at=now()` | ☐ |
| 5.7 | Selin ekranı | Selin | ActiveRideView "Şoför geldi" status, ~3s gecikmeyle | ☐ |
| 5.8 | "Yolculuğu Başlat" tap | Mehmet | `start_ride` RPC → status='in_progress', `started_at`. Trigger: Mehmet `profiles.status` `active → on_trip`, `pre_trip_status='active'` saklanır | ☐ |
| 5.9 | DB:<br>`SELECT status, pre_trip_status FROM public.profiles WHERE id = (SELECT id FROM auth.users WHERE email='mehmet+test@drivermesh.local');` | — | `status='on_trip'`, `pre_trip_status='active'` | ☐ |
| 5.10 | "Yolculuğu Bitir" Card | Mehmet | Ücret (TL) + Mesafe (km) inputlari, "Bitir" buton | ☐ |
| 5.11 | `85` TL, `4.5` km → "Bitir" | Mehmet | `complete_ride` RPC → status='completed', `completed_at`, `fare_final=85`, `distance_km=4.5`. Trigger: Mehmet status `on_trip → active` (restore). useDriverActiveRide null → empty state. **Rating Modal otomatik açılır.** | ☐ |
| 5.12 | Rating Modal | Mehmet | "Müşteriyi değerlendir" + 5 yıldız + comment input + "Atla"/"Gönder" | ☐ |
| 5.13 | 5 yıldız + "Selin çok kibar" → "Gönder" | Mehmet | `submit_driver_rating(p_ride_id, 5, 'Selin çok kibar')` → toast "Teşekkürler, değerlendirme alındı" → modal kapanır | ☐ |
| 5.14 | DB:<br>`SELECT rater_type, ratee_type, stars FROM public.ratings;` | — | 1 satır: rater='driver', ratee='customer', stars=5 | ☐ |
| 5.15 | Selin'in ekranı (3-5 sn sonra) | Selin | "Son yolculuğunu değerlendir" pending banner anasayfada belirir (useActiveRide null transition → pending-rating invalidate → 5s staleTime ile fetch) | ☐ |
| 5.16 | Banner tap → modal | Selin | "Şoförü değerlendir" + 5 yıldız + comment input | ☐ |
| 5.17 | 5 yıldız + "Çok güvenli sürüyor" → Gönder | Selin | `submit_rating` → toast → modal kapanır, banner kaybolur, anasayfa stats güncellenir (toplam yolculuk: 1, toplam km: 4.5) | ☐ |
| 5.18 | DB final:<br>`SELECT rater_type, ratee_type, stars FROM public.ratings ORDER BY created_at;` | — | 2 satır: driver→customer + customer→driver | ☐ |

**Performans gözlemi:**
- Selin'in pending banner gecikmesi: hedef ≤ 5 sn (kullanıcı complete tap → banner görünür). Eski 30s staleTime düzeltildi.
- Network: complete_ride sonrası `ride_requests` polling 1× extra request olabilir (cycle bitirken cleanup); kabul edilebilir.

---

## 8. Senaryo 6 — Edge Cases

**Aktörler:** Selin + Mehmet | **Süre:** ~20 dk

> Önce **§0 RESET'i tekrar koştur** (önceki ride DB'de duruyor; her edge case'i temiz başlat). Veya: yeni Selin/Mehmet hesabıyla devam edip filtreyi `requested_at > now() - interval '1 hour'` ile sınırla.

### 6.1 Double-tap idempotency (request_ride)

| # | Adım | Beklenen | ✅/❌ |
|---|---|---|---|
| 6.1.1 | DevTools → Network → throttle "Slow 3G" + "Çağır" butonuna **hızlıca 2 kez** bas | Sadece **1** ride_request satırı. İkinci RPC `T7: active ride exists` döner | ☐ |
| 6.1.2 | DB:<br>`SELECT COUNT(*) FROM public.ride_requests WHERE customer_id='<selin>' AND status NOT IN ('completed','cancelled_by_customer','cancelled_by_driver','cancelled_by_system');` | 1 | ☐ |
| 6.1.3 | Partial UNIQUE index check:<br>`SELECT indexname FROM pg_indexes WHERE tablename='ride_requests' AND indexname='ride_requests_one_active_per_customer';` | 1 row | ☐ |

### 6.2 T6 — Filo ride_enabled kapalı

| # | Adım | Beklenen | ✅/❌ |
|---|---|---|---|
| 6.2.1 | Ayşe → Hesap → "Yolcu Hizmeti" → toggle OFF | DB: `fleets_visibility.ride_enabled = false` | ☐ |
| 6.2.2 | Selin "Çağır" tap | `T6: fleet ride disabled` toast | ☐ |
| 6.2.3 | Selin vehicle list (refresh) | Boş ("Bu çevrede araç yok") — `ride_search_vehicles` filtreler | ☐ |
| 6.2.4 | Toggle ON tekrar | Mehmet'in aracı yeniden listede | ☐ |

### 6.3 T11 — Driver status non-active

| # | Adım | Beklenen | ✅/❌ |
|---|---|---|---|
| 6.3.1 | Mehmet status pill → "Mola" | `profiles.status = 'break'` | ☐ |
| 6.3.2 | Selin vehicle list (refresh) | Boş — driver active değil | ☐ |
| 6.3.3 | Selin doğrudan `request_ride` (eski vehicle_id ile cached call) | `T11: driver unavailable (role/status)` error | ☐ |
| 6.3.4 | Mehmet status → "Aktif" tekrar | Mehmet'in aracı listede | ☐ |

### 6.4 T12 — Mesai saati dışı

| # | Adım | Beklenen | ✅/❌ |
|---|---|---|---|
| 6.4.1 | SQL:<br>`UPDATE public.fleets_visibility SET operating_hours = jsonb_build_object('tz','Europe/Istanbul', 'mon', '[]'::jsonb, 'tue','[]'::jsonb, 'wed','[]'::jsonb, 'thu','[]'::jsonb, 'fri','[]'::jsonb, 'sat','[]'::jsonb, 'sun','[]'::jsonb);` (her gün boş array → her zaman kapalı) | `is_fleet_open` false döner | ☐ |
| 6.4.2 | Selin "Çağır" → `T12: fleet closed (operating hours)` | ☐ | |
| 6.4.3 | SQL: `UPDATE public.fleets_visibility SET operating_hours = NULL;` (NULL → 7/24) | Test yeniden çalışır | ☐ |

### 6.5 T8 — Aktif ride iken araç başkasına geçemez

| # | Adım | Beklenen | ✅/❌ |
|---|---|---|---|
| 6.5.1 | Selin çağırır → status='assigned' | active ride var | ☐ |
| 6.5.2 | Ayşe (owner) → SQL ile vehicle reassign:<br>`UPDATE public.vehicles SET current_user_id='<ayse>' WHERE id='<vito>';` | Trigger `vehicles_block_reassign_during_active` reddedeerek `T8: vehicle on active ride` exception fırlatır | ☐ |
| 6.5.3 | Mehmet ride'ı tamamlar → ride status=completed | Trigger artık tetiklenmez, reassign mümkün | ☐ |

### 6.6 Cancel by customer

| # | Adım | Beklenen | ✅/❌ |
|---|---|---|---|
| 6.6.1 | Selin yeni ride çağır → status='assigned' | active | ☐ |
| 6.6.2 | ActiveRideView → "İptal Et" → confirm | `cancel_ride` RPC → status='cancelled_by_customer' | ☐ |
| 6.6.3 | Mehmet ekranı | "Aktif yolculuk yok" empty state | ☐ |

### 6.7 Cancel by driver (varsa UI)

V1'de driver-side cancel UI yok; SQL ile manuel:
```sql
UPDATE public.ride_requests SET status='cancelled_by_driver' WHERE id='<ride>';
```
Selin tarafında banner kaybolur, "Yolculuk iptal edildi" mesajı çıkar (eğer UI varsa).

---

## 9. Senaryo 7 — Push Notification Deep-Link

**Süre:** ~5 dk | **Önkoşul:** Release/preview APK kurulu (debug build'de push çalışmayabilir) + FCM token kaydedilmiş (`SELECT push_token FROM public.profiles;` dolu)

| # | Adım | Beklenen | ✅/❌ |
|---|---|---|---|
| 7.1 | Selin yeni ride çağırır → Mehmet'e backend push (FCM tetiklenir) | Cihazda banner notification, içerik "Yeni yolculuk" + araç pickup adresi | ☐ |
| 7.2 | Mehmet cihazda banner tap (uygulama kapalı) | Cold start: fleet açılır + `routeForPushPayload({screen:'driver_ride'})` → `/(app)/driver-ride` ekranında belirir (anasayfa değil) | ☐ |
| 7.3 | Uygulama foreground'da iken yeni push | Banner toast + `addNotificationResponseReceivedListener` listener `router.push('/(app)/driver-ride')` çağırır | ☐ |
| 7.4 | Bilinmeyen `data.screen` değeri ile manuel push test (PowerShell):<br>`Invoke-RestMethod -Uri "$env:SUPABASE_URL/functions/v1/send-push" -Method POST -Headers @{Authorization="Bearer $env:ANON"} -Body (@{recipient_id='<m>';type='test';data=@{screen='unknown_route'}} \| ConvertTo-Json)` | Bilinmeyen → home (`/(app)`) — arbitrary route injection yok | ☐ |
| 7.5 | Ride app benzeri test (Selin'de) | `routeForPushPayload({screen:'rating'})` → ride home (V1, V2'de ride/[id]) | ☐ |

---

## 10. Senaryo 8 — Force Update

**Süre:** ~7 dk | **Test:** composite key (platform, app) isolation

### 10.1 Fleet hard-block

| # | Adım | Beklenen | ✅/❌ |
|---|---|---|---|
| 8.1.1 | SQL:<br>`UPDATE public.app_versions SET min_supported_version='9.9.9', latest_version='9.9.9' WHERE platform='android' AND app='fleet';` | — | ☐ |
| 8.1.2 | Fleet'i restart (cold start) | Tam ekran modal: "Önemli güncelleme gerekiyor" + "Hemen Güncelle" (sadece store linki, kapatma yok) | ☐ |
| 8.1.3 | Selin ride web'i refresh | Ride etkilenmez (app='ride' ayrı satır, 0.1.0 = current) | ☐ |
| 8.1.4 | Geri al:<br>`UPDATE public.app_versions SET min_supported_version='1.0.0', latest_version='1.0.0' WHERE platform='android' AND app='fleet';` | Fleet restart → normal startup | ☐ |

### 10.2 Ride hard-block (cross-app isolation)

| # | Adım | Beklenen | ✅/❌ |
|---|---|---|---|
| 8.2.1 | SQL:<br>`UPDATE public.app_versions SET min_supported_version='9.9.9', latest_version='9.9.9' WHERE platform='android' AND app='ride';` | — | ☐ |
| 8.2.2 | Ride web refresh | ForceUpdateModal: "Bu sürümü desteklemiyoruz" + store linki | ☐ |
| 8.2.3 | Fleet'i restart | Fleet etkilenmez (app='fleet' ayrı row) | ☐ |
| 8.2.4 | Geri al | Ride refresh → normal | ☐ |

### 10.3 Soft prompt

| # | Adım | Beklenen | ✅/❌ |
|---|---|---|---|
| 8.3.1 | SQL:<br>`UPDATE public.app_versions SET min_supported_version='1.0.0', latest_version='9.9.9', release_notes_tr='Yeni özellikler ve düzeltmeler.' WHERE platform='android' AND app='fleet';` | — | ☐ |
| 8.3.2 | Fleet restart | Anasayfada banner (dismissable X), "Yeni sürüm var" | ☐ |
| 8.3.3 | X ile dismiss | 24 saat boyunca tekrar gösterilmez (AsyncStorage `drivermesh.force_update.soft_dismiss_at`) | ☐ |

---

## 11. Performans + Güvenlik Kontrol Noktaları

Her senaryodan sonra (özellikle S5 sonunda) bu kontrolleri yap:

### 11.1 Baseline + delta

| Kontrol | Komut | Beklenen baseline (RESET sonrası) |
|---|---|---|
| Sentry yeni event | dashboard.sentry.io → project `drivermesh-mobile` ve `drivermesh-ride`, filter `event.timestamp > <test_start>` | 0 unexpected; sadece info breadcrumb'lar |
| DB security advisor | `mcp__supabase__get_advisors(type='security')` | 1 ERROR (spatial_ref_sys), ~84 WARN. Test sonu delta yoksa OK. |
| DB performance advisor | `mcp__supabase__get_advisors(type='performance')` | ~94 INFO + 87 WARN baseline; test sırasında yeni `multiple_permissive_policies` veya `unindexed_foreign_keys` artmamalı |
| Metro/Console error | Browser DevTools + adb logcat `*:E` filter | 0 unhandled error |

### 11.2 Idempotency (S6.1 ile birlikte)

- partial UNIQUE index `ride_requests_one_active_per_customer` çalışıyor mu? S6.1.3 sayım = 1.
- `submit_rating` ikinci çağrı `already rated` error verir.
- `submit_driver_rating` ikinci çağrı aynı şekilde.

### 11.3 RLS politikaları sızıntı testi

- Selin'in customer_id'siyle başka customer'ın ride_requests'lerini sorgula:
  ```sql
  -- service-role değil, anon yetki ile (Supabase Studio SQL Editor "Role: anon" seç)
  SELECT * FROM public.ride_requests WHERE customer_id != '<selin>';
  ```
  Beklenen: 0 satır (RLS başka customer'ları bloklar).
- Mehmet driver olarak Ayşe'nin organization profile'lerini görebilir mi? (aynı org → evet, başka org → hayır).

### 11.4 devSignIn release gate (manual)

- Production APK string-dump:
  ```bash
  unzip -p app-release.apk classes.dex | strings | grep dev-customer
  ```
  String bulunabilir (Hermes bundle hardcoded'ed), ama `signInWithPassword({email: 'dev-customer@...'})` çağrısı app'ten **tetiklenmez** çünkü `devSignIn = undefined` (release `__DEV__=false`).
- Manuel verifikasyon: production build APK'sını kur → phone screen'de "Demo" / "Skip" / fallback buton **görünmemeli**, sadece OTP yolu.

### 11.5 Sentry app tag isolation

- Sentry dashboard'ta fleet ve ride event'leri filter:
  - `app:fleet` → fleet'ten gelmiş olmalı
  - `app:ride` → ride'tan gelmiş olmalı
- Test sırasında fırlatılan herhangi bir hata (kasıtlı veya değil) doğru tag ile gelmeli.

### 11.6 Network sızıntı

- Browser DevTools Network → 3rd party host listesi:
  - `*.supabase.co` (DB, Auth, Storage, Functions)
  - `googleapis.com` (Maps, varsa)
  - `firebaseinstallations.googleapis.com` (FCM)
  - `*.sentry.io` (telemetri)
  - **Yabancı host varsa** → araştır. Adtracker veya 3rd party CDN olmamalı.

---

## 12. Bug Bildirim Şablonu

Her Fail için doldur:

```markdown
### BUG-<sequence>: <kısa başlık>

| Alan | Detay |
|---|---|
| Senaryo | §X — Adım X.Y |
| Aktör | Ayşe / Mehmet / Selin |
| Cihaz/Tarayıcı | Xiaomi 220333QPG Android 11 / Chrome 124 incognito |
| Beklenen | (test rehberinden) |
| Gerçek | (gözlenen) |
| Tekrar üretilebilir mi? | Evet (her seferinde) / Bazen / Bir kez |
| Severity | P0 (blocker) / P1 (önemli) / P2 (minor) / P3 (kozmetik) |
| Log/Event | Sentry event ID `<...>`, Metro log satır N, SQL state `<...>` |
| Yan etki | (varsa: data corruption, session loss, vs.) |
| Workaround | (varsa) |
| Önerilen düzeltme | (kısa) |
```

---

## 13. Final Test Raporu Şablonu

```markdown
# Test Pass Raporu — <YYYY-MM-DD HH:MM>

## Özet
- Tester A: <ad>
- Tester B: <ad>
- DB Reset: ✅ <timestamp> (§0 SQL apply_migration)
- Süre: <X dk>

## Senaryo Sonuçları
| Senaryo | Pass/Fail | Notlar |
|---|---|---|
| §3 Filo Başlatma | ✅ |  |
| §4 Şoför Daveti | ✅ |  |
| §5 Filo Yapılandırma | ✅ |  |
| §6 Müşteri Kaydı | ✅ |  |
| §7 Cross-app E2E | ⚠️  | BUG-1 (pending banner 8s, hedef ≤5s) |
| §8 Edge Cases | ✅ |  |
| §9 Push Deep-Link | — | (release build yok, atlandı) |
| §10 Force Update | ✅ |  |

## Bug Listesi
- BUG-1 (P2): … 
- BUG-2 (P1): …

## Performans Gözlemleri
- Cold start (fleet): X sn
- Cold start (ride web bundle): X sn
- request_ride RPC latency (avg): X ms
- complete_ride → pending banner: X sn

## Güvenlik Gözlemleri
- DB advisor delta: +0 ERROR / +0 WARN
- Sentry tag isolation: ✅
- RLS sızıntı: ✅ (anon başka customer ride'larını görmedi)

## V2 Önerileri / Backlog
- …
```

---

## 14. Referans: Reset SQL Detayı + Sistem Tablo Koruma Listesi

### 14.1 TRUNCATE'in DROP'tan farkı

| İşlem | Schema | Index/RLS/Trigger | Veri | Geri alma |
|---|---|---|---|---|
| `DROP TABLE` | Silinir | Silinir | Silinir | Migration script |
| `TRUNCATE` | **Kalır** | **Kalır** | Silinir | Backup |
| `DELETE FROM` | Kalır | Kalır | Silinir | Transaction rollback |

Reset SQL **sadece TRUNCATE + DELETE FROM**, hiçbir DROP yok.

### 14.2 Sistem tabloları (DOKUNULMAZ)

| Tablo | Kullanım | Drop edilirse ne olur |
|---|---|---|
| `public.app_versions` | Force update | Fleet/ride startup'ta DB sorgusu boş döner; fail-open ile geçer ama no force-update koruma |
| `public.permission_keys` | RLS policy enforcement | Permission overrides çalışmaz, "permission not found" |
| `public.role_default_permissions` | Owner/manager/driver UI menü kontrolü | Tüm rolelere her şey açık fallback (TEHLİKELİ) |
| `public.fare_config` | Ride fiyatlandırma | Fare nullable, V1'de etki minimum |
| `public.spatial_ref_sys` | PostGIS SRID | Geo sorguları (ST_SetSRID) fail |
| `auth.identities`, `auth.refresh_tokens`, `auth.audit_log_entries` | Supabase auth altyapısı | Login akışı bozulur |

### 14.3 RPC ve trigger sayımı (RESET sonrası beklenen)

```sql
SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname='public' AND p.prokind='f';  -- ~9 RPC + helper fonksiyonlar

SELECT COUNT(*) FROM pg_trigger WHERE tgrelid::regclass::text LIKE 'public.%' AND NOT tgisinternal;  -- ~10 trigger
```

Beklenen: count'lar değişmez (TRUNCATE şemaya dokunmaz).

### 14.4 RESET sonrası akıl kontrolü (smoke)

```sql
-- 1) Auth signup hala çalışır mı? (trigger on_auth_fleet_owner_signup hayatta mı)
-- Manuel test: Welcome → "Filo Başlat" → email/parola → DB'de organization + profile otomatik düşer
-- 2) RPC'ler hala çağrılabilir mi?
SELECT public.is_fleet_open(gen_random_uuid());  -- false döner (org yok, ama exception fırlatmaz)
```

---

## 15. Bilinen Limitasyonlar + V2 Bekleyenler

### 15.1 V1'de yok olanlar (V2 bekleyenler)
- Vehicle "Üzerine Al" buton fleet UI'da (RPC `claim_vehicle_for_ride` var, UI yok — şimdilik SQL ile çalıştırılır)
- Driver-side cancel UI (sadece SQL UPDATE ile)
- Realtime channel (3s polling V2'de değişecek)
- Driver ETA canlı güncellemesi (V2)
- Cancel grace period UI (V2)
- Ride history ekranı (`listMyRides` fonksiyonu var, UI yok)
- Per-app anon key (tek `EXPO_PUBLIC_SUPABASE_ANON_KEY` paylaşılıyor)
- Operating hours UI (jsonb config var, UI yok)

### 15.2 Bilinen sınırlar
- React Native Web Pressable onPress race (Selin testlerinde preview_eval fallback)
- Maps "Authorization failure" — Google Cloud billing aktivasyonu beklenir; UI logic test edilebilir, harita render bekleyebilir
- Reanimated reduced motion uyarısı (kozmetik)

### 15.3 Audit-discovered (resolve edilmemiş)
- DB security: 84 WARN (RLS initplan, multiple permissive policies, SECDEF fn yetki review) — performans + güvenlik etkisi orta vadeli
- DB performance: 87 WARN (auth_rls_initplan x67, unindexed_foreign_keys x40, multiple_permissive_policies x20)
- `filoLocal` schema'sı (eski/POC) — TRUNCATE edildi ama schema duruyor; gerekirse `DROP SCHEMA "filoLocal" CASCADE` ayrı bir migration ile yapılır

### 15.4 Dev bypass'lar (production'a geçerken kaldırılacak)
- Ride: `phone.tsx` `if (__DEV__ && devSignIn)` (Twilio entegrasyonu sonrası `devSignIn` fonksiyonu tamamen kaldırılır)
- Ride: `AuthProvider.devSignIn = __DEV__ ? ... : undefined` (aynı)
- Ride: `useGeolocation` `__DEV__` Galata mock (production'da gerçek konum)
- Fleet: `forceUpdate.checkForceUpdate` `appEnv !== 'production'` skip (uygun)

---

## 16. Otomatik Unit Test (Jest)

E2E manuel senaryoların (§3-§10) yanı sıra **2026-05-20 itibarıyla** lokal Jest test altyapısı kuruldu. Her iki app (`fleet/`, `ride/`) kendi `jest.config.js` + `jest.setup.js`'ine sahip; CI ([.github/workflows/ci.yml](../.github/workflows/ci.yml)) her PR'da çalıştırır.

### Çalıştırma

```bash
cd fleet && npm test          # interaktif watch yok, --watch ekle
cd ride && npm test
```

Coverage: `npm test -- --coverage`.

### Preset

- `jest-expo` 55 (RN transform pattern'i içerir)
- AsyncStorage, Sentry, Supabase env stub'ları her iki `jest.setup.js`'de hazır
- `moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' }` — uygulama alias'ı

### Mevcut test kapsamı (başlangıç)

| Modül | Test | Niye |
|---|---|---|
| [fleet/src/lib/\_\_tests\_\_/offlineQueue.test.ts](../fleet/src/lib/__tests__/offlineQueue.test.ts) | enqueue idempotent, flush success/fail, 5-attempt drop, last-writer-wins | Offline write queue Sprint C'nin omurgası, regression yakalanmalı |
| [ride/src/utils/\_\_tests\_\_/forceUpdate.test.ts](../ride/src/utils/__tests__/forceUpdate.test.ts) | semverLt pure logic — eşitlik, eksik segment, leading-zero patch | Versiyon karşılaştırma yanlışı tüm app'i force-update'e zorlar |

### Yeni test eklerken

1. Dosyayı modülün yanına koy: `src/foo/__tests__/foo.test.ts` veya `src/foo/foo.test.ts`.
2. Eğer modül `supabase`, `@sentry/react-native` veya AsyncStorage import ediyorsa → mock zaten setup'ta hazır, ek bir şey gerekmez.
3. RPC çağıran kodu test ederken: yardımcı pure fonksiyonu `export` et + ona unit test yaz. Gerçek RPC integration test'i E2E'ye (manuel + smoke script) bırak.
4. **Snapshot test'lerinden kaçın** — RN render snapshot'ları kırılgan; davranış test'i tercih et.

### Edge function smoke test (Python)

Edge function'lar (chat-bot, kb-ingest, vs.) için Python smoke script'leri `scripts/` altında:

- [scripts/smoke_test_kb_rag.py](../scripts/smoke_test_kb_rag.py) — sandbox driver yarat → JWT al → POST chat-bot → assert kb_hits → cleanup
- [scripts/test_chatbot.py](../scripts/test_chatbot.py) — chat-bot manuel deneme

Bunlar CI'da çalışmaz (network + Supabase auth + temp user gerekir), lokal release smoke'unda manuel çalıştırılır.

---

*Doküman versiyonu: 2.1 — Jest unit test bölümü §16 eklendi (2026-05-20).*
