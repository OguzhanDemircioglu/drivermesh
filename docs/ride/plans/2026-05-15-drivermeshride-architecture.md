# DriverMesh Ride — Mimari & Entegrasyon

**Tarih:** 2026-05-15
**Yazan:** Brainstorming oturumu çıktısı (oğuzhan + claude)
**Durum:** Onaylandı, implementasyon başlayacak

---

## 0. Bağlam

DriverMesh ekosisteminde **iki ayrı mobil uygulama** yan yana yaşayacak:

| Proje | Klasör | Kullanıcı | Auth |
|---|---|---|---|
| **Fleet** (mevcut) | `C:\Projeler\drivermesh\` | Filo çalışanları (owner/manager/driver) | E-posta + şifre |
| **Ride** (yeni) | `C:\Projeler\drivermesh\ride\` | Müşteri/yolcu | Telefon + SMS OTP |

İkisi aynı Supabase projesini paylaşır (`ucitxvsndlwvvnqwabgo`), **kod paylaşmaz**. Fleet projesine kodda veya dosya hareketinde **dokunulmaz**.

---

## 1. Klasör yapısı

```
C:\Projeler\drivermesh\
├── app/ src/ android/ assets/ ...        ← FLEET (DOKUNULMAZ)
├── package.json eas.json app.json …      ← FLEET (DOKUNULMAZ)
│
└── ride/                                  ← YENİ — bağımsız Expo projesi
    ├── app/                              ← Expo Router file-based
    ├── src/                              ← lib, components, theme, i18n, auth, hooks
    ├── assets/                           ← drivermesh.webp + fontlar
    ├── package.json                      ← bağımsız, kendi node_modules
    ├── app.json                          ← bundle id: app.drivermesh.ride
    ├── eas.json                          ← ride'ın kendi EAS profilleri
    └── tsconfig.json
```

---

## 2. Teknoloji stack'i (performans odaklı)

| Katman | Seçim | Gerekçe |
|---|---|---|
| Expo SDK | 54 | Fleet ile aynı |
| React / RN | 19 / 0.81 | Compiler ile auto-memoization |
| TypeScript | 5.9 strict | Hata bulma compile-time |
| Routing | Expo Router v6 | File-based, native stack/tabs |
| Server state | **TanStack Query v5 + AsyncStorage persister** | Cache-first cold start, disk cache, refetch on focus |
| Client state | React Context + RHF + Zod | Zustand yok (basit app) |
| i18n | i18next + react-i18next | TR (default) + EN |
| Map | react-native-maps + Google | Fleet ile aynı, .env'den anahtarı kopyala |
| Notifications | expo-notifications + `send-push` Edge Function | Mevcut backend yeniden kullanılır |
| Image | expo-image | 2-3× hızlı, otomatik cache |
| Geolocation | expo-location | GPS + reverse geocode |
| Crash | **Sentry yok** (V1) | Cold start hız önceliği |

---

## 3. Veri modeli — mevcut şema KULLANILIR

Schema migration `20260514002601 add_driverride_v1_schema` ride sistemini zaten kurmuş. Yeni tablo eklemiyoruz; mevcut yapıyı kullanıyoruz.

### Ride'ın yazdığı/okuduğu tablolar

| Tablo | Ride'ın ilişkisi | Notlar |
|---|---|---|
| `customers` | INSERT (signup), UPDATE (profil) | `auth_user_id`, `phone`, `full_name`, `push_token`, `language`, `total_rides`, `avg_rating` |
| `ride_requests` | INSERT, UPDATE (cancel), SELECT (realtime) | Ana entity. `customer_id`, `vehicle_id`, `driver_id`, `pickup_point` (PostGIS), status enum 9-state |
| `ratings` | INSERT (yolculuk sonrası) | `rater_type='customer'`, `ratee_type='driver'`, stars + comment |
| `payments` | SELECT (V1 cash only, fleet yazar) | Görüntüleme amaçlı |
| `customer_notifications` | SELECT (V1 history ekranı yok, V2 için saklı) | Edge Function `send-push` yazar |
| `fleets_visibility` | SELECT | `ride_enabled=true` olan filolar |
| `vehicles` | SELECT | Müsait araç listesi (status='idle' + current_user_id) |
| `profiles` | SELECT (driver bilgisi) | Şoför adı, telefonu, avatar |
| `organizations` | SELECT (HQ konumu) | hq_lat/lng |
| `fare_config` | YOK (V1, dropoff olmadığı için fiyat hesaplanmıyor) | V2 |
| `ride_offers` | YOK (V1, matching algoritması yok) | V2 |

### Ride asla yazmaz
`vehicles`, `profiles`, `organizations`, `jobs`, `fleets_visibility`, `fare_config`, `ride_offers` — sadece SELECT.

---

## 4. Yeni migration'lar (ride'dan tetiklenir)

```sql
-- M1: Müşteri dropoff vermez (sözlü alır). Mevcut fleet insert'leri etkilenmez (fleet dolduruyor).
ALTER TABLE ride_requests ALTER COLUMN dropoff_address DROP NOT NULL;
ALTER TABLE ride_requests ALTER COLUMN dropoff_point DROP NOT NULL;
ALTER TABLE ride_requests ALTER COLUMN fare_estimate DROP NOT NULL;

-- M2: Müşterinin RLS politikası (customers tablosu)
ALTER POLICY customers_self_read ON customers
  USING (auth_user_id = auth.uid());
-- (varsa düzelt; yoksa CREATE POLICY ekle)

-- M3: ride_requests RLS — müşteri sadece kendi satırlarını görür/yazar
CREATE POLICY ride_requests_customer_rw ON ride_requests
  FOR ALL USING (
    customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid())
  );

-- M4: ratings RLS — müşteri sadece kendi rate'lerini yazar/okur
CREATE POLICY ratings_customer_rw ON ratings
  FOR ALL USING (
    rater_type = 'customer'
    AND rater_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid())
  );

-- M5: customer_notifications RLS — müşteri kendi bildirimlerini görür
CREATE POLICY customer_notif_self_read ON customer_notifications
  FOR SELECT USING (
    customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid())
  );

-- M6: Müşterinin müsait fleet vehicles'ı görmesi (PostGIS service_area kontrolü)
-- View yerine RPC: ride_search_vehicles(customer_lat, customer_lng)
-- → fleets_visibility.service_area ST_Contains kontrolü + vehicles JOIN
-- (RPC SECURITY DEFINER, anon'a izin verilmez, sadece authenticated)

-- M7: Atomic ride request — yarış koşulu engeli
CREATE OR REPLACE FUNCTION request_ride(
  p_vehicle_id UUID,
  p_pickup_point geography,
  p_pickup_address TEXT
) RETURNS UUID AS $$
DECLARE
  v_customer_id UUID;
  v_driver_id UUID;
  v_org_id UUID;
  v_ride_id UUID;
BEGIN
  -- 1. Customer'ı al
  SELECT id INTO v_customer_id FROM customers
  WHERE auth_user_id = auth.uid();
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Customer profil yok';
  END IF;

  -- 2. Aktif yolculuk koruması
  IF EXISTS (
    SELECT 1 FROM ride_requests
    WHERE customer_id = v_customer_id
      AND status IN ('searching','assigned','driver_arrived','in_progress')
  ) THEN
    RAISE EXCEPTION 'Zaten aktif bir yolculuğun var';
  END IF;

  -- 3. Araç müsait mi? (locked select)
  SELECT current_user_id, organization_id INTO v_driver_id, v_org_id
  FROM vehicles
  WHERE id = p_vehicle_id
    AND status = 'idle'
    AND current_user_id IS NOT NULL
    AND maintenance_started_at IS NULL
  FOR UPDATE;

  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'Araç müsait değil';
  END IF;

  -- 4. Fleet ride enabled mi?
  IF NOT EXISTS (
    SELECT 1 FROM fleets_visibility
    WHERE organization_id = v_org_id AND ride_enabled = true
  ) THEN
    RAISE EXCEPTION 'Bu fleet ride entegrasyonu kapalı';
  END IF;

  -- 5. ride_requests insert
  INSERT INTO ride_requests (
    customer_id, vehicle_id, driver_id, organization_id,
    pickup_point, pickup_address, status, payment_method
  ) VALUES (
    v_customer_id, p_vehicle_id, v_driver_id, v_org_id,
    p_pickup_point, p_pickup_address, 'assigned', 'cash'
  ) RETURNING id INTO v_ride_id;

  -- 6. send-push Edge Function tetikle (pg_net ile async)
  -- ...

  RETURN v_ride_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 5. Auth modeli

| Aktör | Tablo | Auth yöntemi |
|---|---|---|
| Owner / Manager / Driver | `profiles` (auth.users.id = profiles.id) | Email + şifre |
| Customer | `customers` (auth.users.id = customers.auth_user_id) | Telefon + SMS OTP |

Aynı `auth.users` havuzu paylaşılır ama domain entity'leri ayrı. Teorik olarak bir kişi hem fleet'te driver hem ride'da customer olabilir — UI kontekstine göre doğru entity'ye düşer.

**Ride'ın auth flow'u:**
1. Welcome → "Telefonla başla"
2. Phone (+90 + 10 hane) → `supabase.auth.signInWithOtp({ phone })`
3. Verify OTP (6 hane) → `supabase.auth.verifyOtp(...)`
4. İlk girişse `customers` satırı yoksa → Profile setup (ad soyad)
5. `customers` upsert (auth_user_id, phone, full_name, language='tr')

---

## 6. Ekran haritası v1.0

```
ride/app/
├── _layout.tsx                ← Provider'lar + Splash gating
├── index.tsx                  ← Gate: session var → (app), yoksa (auth)
│
├── (auth)/                    ← drivermesh.webp tam ekran arka plan
│   ├── _layout.tsx
│   ├── welcome.tsx            ← Logo + "Telefonla başla"
│   ├── phone.tsx              ← Telefon input
│   ├── verify-otp.tsx         ← 6 hane OTP
│   └── profile-setup.tsx      ← Ad soyad
│
└── (app)/
    ├── _layout.tsx
    ├── (tabs)/
    │   ├── _layout.tsx        ← BottomNav: Ana / Araçlar / Hesap
    │   ├── home.tsx           ← idle state + active state (state machine)
    │   ├── vehicles.tsx       ← şehir select + müsait araç grid
    │   └── account.tsx        ← profil + dil + yardım + çıkış
    ├── ride/
    │   ├── call-modal.tsx     ← pickup auto + "Çağır" + 60sn bekleme
    │   └── rating.tsx         ← yıldız + opsiyonel yorum
    ├── account/
    │   ├── edit-profile.tsx
    │   └── help.tsx           ← SSS accordion + form (send-support-message)
    └── trip-detail.tsx
```

**Toplam: 13 ekran** (auth 4 + tabs 3 + ride modal+rating 2 + util 4)

---

## 7. Ride akış zinciri

```
[Vehicles tab]
   │ Şehir select (default: GPS reverse-geocode)
   │ "ride_search_vehicles(lat, lng)" RPC
   │ → service_area içindeki + ride_enabled=true filolardan
   │   müsait araçlar grid'de
   │
   tap "Çağır"
   │
   ▼
[CallModal]
   │ pickup_point = GPS (expo-location)
   │ pickup_address = reverse-geocode
   │ Onayla → request_ride(vehicle_id, pickup_point, pickup_address) RPC
   │ ride_requests insert (status='assigned', vehicle_id, driver_id set)
   │ send-push tetiklenir → şoföre "Yeni iş" bildirimi
   │
   60sn bekle (modal)
   │ Şoför fleet'te kabul: ride_requests.status='in_progress' (or stays 'assigned' & arrived state)
   │ Realtime: customer abone, status değişimi yakalanır
   │ Push: ride_accepted → customer_notifications insert + send-push
   │
   ▼
[Home — active state]
   │ Modal kapanır, anasayfa active state'e geçer
   │ Harita render: pickup pin (customer konum)
   │ Araç ikonu üstten 800ms entrance animasyon
   │ → şoförün organization.hq_lat/lng'sine yerleşir (V1 dekoratif)
   │ Status banner: "Şoför yolda"
   │ Buttons: "Ara" (tel:driver.phone) + "İptal"
   │
   │ Şoför "vardım" der → ride_requests.status='driver_arrived'
   │ Push: ride_driver_arrived
   │ Banner: "Şoför geldi! 34 ABC 123"
   │
   │ Şoför "başla" der → status='in_progress'
   │ Banner: "Yoldayız"
   │
   │ Şoför "bitir" der → status='completed'
   │ Push: ride_completed (rating ekranı için tap-target)
   │
   ▼
[Rating modal]
   │ 1-5 yıldız + opsiyonel yorum
   │ Submit → ratings INSERT (rater_type='customer', ratee_type='driver')
   │ Home idle state'e dön
```

**İptal akışı:** Müşteri her durumda iptal edebilir (ücretsiz). Confirm modal → `ride_requests.status='cancelled_by_customer'` → şoföre push.

---

## 8. State management detay

### Server state (TanStack Query)
- `useCustomerProfile()` → SELECT customers WHERE auth_user_id = me
- `useRideSearchVehicles(lat, lng, city)` → RPC `ride_search_vehicles`
- `useActiveRide()` → SELECT ride_requests + Realtime subscribe
- `useRideHistory()` → SELECT ride_requests + ratings JOIN
- `useStats()` → SELECT customers (total_rides, avg_rating) + COUNT(km)
- Persister: AsyncStorage, gcTime 24h, staleTime 5dk
- refetchOnWindowFocus, refetchOnReconnect

### Client state
- `AuthContext` (session + customer profile)
- `ThemeContext` (statik, render once)
- `ToastContext` (in-portal)
- `RideRealtimeContext` (active ride channel subscription)

### Realtime
- Sadece active ride sırasında: `supabase.channel('ride:${id}').on('postgres_changes', {...})`
- Status değişimi → React Query cache invalidate + state machine update

---

## 9. Performans bütçesi

| Metrik | Hedef |
|---|---|
| Cold start → interactive | < 1.5s (mid Android) |
| Sekme geçişi | < 100ms |
| Liste scroll | 60fps (FlashList) |
| Tap-to-paint | < 16ms |

**Cold start optimizasyon kanalları:**
1. Native splash drivermesh.webp (Expo splash, JS bridge yüklenmeden)
2. AuthProvider'da `initialSessionPromise` modül load anında başlar
3. Font: Noto Sans regular/semibold/bold eager; medium/black lazy
4. Provider tree: 4 katman max (Auth/Theme/Toast/QueryClient)
5. Sentry yok = init zamanı yok
6. expo-image disk + memory cache → ikinci açılışta backdrop instant

---

## 10. Push notification (V1: 4 event)

| Event | Trigger | Title | Body |
|---|---|---|---|
| `ride_accepted` | ride_requests status update | "Şoför kabul etti" | "{driver} yola çıkıyor" |
| `ride_driver_arrived` | status='driver_arrived' | "Şoför geldi" | "{plate} • {brand} {model}" |
| `ride_completed` | status='completed' | "Yolculuğun bitti" | "Şoförü değerlendir →" |
| `ride_cancelled_by_driver` | status='cancelled_by_driver' | "Şoför iptal etti" | "Başka araç çağırabilirsin" |

**Mekanizma:**
- Trigger fonksiyonu: `ride_requests` UPDATE → `pg_net` ile `send-push` Edge Function çağrı
- `send-push` customers.push_token + push_platform okur, FCM/APNs gönderir, `customer_notifications` insert eder
- Ride app `expo-notifications` ile permission alır, token register'ı customers.push_token'a yazar (AuthProvider'da)

---

## 11. KVKK & RLS

- **customers** — sadece kendi satırı (read/update)
- **ride_requests** — sadece `customer_id = my_customer_id`
- **ratings** — `rater_id = my_customer_id` (kendi yazdıkları + şoföre verilenler)
- **customer_notifications** — sadece kendi
- **vehicles + profiles** — public-readable alt küme (yeni VIEW veya RPC): plate, brand, model, color, year, photo_url, driver_name, driver_avatar, **driver_phone (yalnızca müsait şoförler)**
- **organizations.hq_lat/lng** — public-readable (harita için)

`driver_phone` müsait şoförler için public görünür (kullanıcı kararı). Yarın spam olursa rate limit veya proxy çözüme geçilecek.

---

## 12. Map & geolocation

- **API key:** `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` — `ride/.env`'e fleet'in `.env`'inden kopyala
- **MapView:** `react-native-maps` + `PROVIDER_GOOGLE`
- **GPS izni reddedilirse:** Vehicles tab'ında "Konum izni gerekli" banner + "Ayarları aç" CTA, çağır butonları disabled
- **Reverse geocode:** Google Geocoding API (rate limit'e dikkat) veya `expo-location.reverseGeocodeAsync`
- **Şehir adı:** GPS lat/lng → reverse geocode → admin_area[1] (il)

---

## 13. i18n

- `i18next` + `react-i18next`
- Namespace: `common` (TR eager, EN lazy import)
- AsyncStorage'ta dil tercihi
- Account → "Dil" pill toggle TR/EN; canlı değiştirme

---

## 14. Test & CI/CD

- **Manuel doğrulama:** Expo web preview (`cd ride && npx expo start --web`) — memory'de kayıtlı kural
- **Unit:** Jest + RNTL — sadece kritik helper (lib/db/*, lib/auth/phoneAuth.ts)
- **E2E:** V2
- **CI:** GitHub Actions, ride/ path filter ile tetiklenir, typecheck + jest
- **EAS profilleri:**
  - `preview` → Android APK, internal distribution
  - `production` → AAB + iOS .ipa, store-ready
- **Bundle ID:** `app.drivermesh.ride` (hem iOS hem Android)
- **EAS Project ID:** Yeni oluşturulacak

---

## 15. Implementation faz planı

| Faz | İçerik | Tahmini |
|---|---|---|
| **F1** | Proje iskelet: package.json, tsconfig, app.json, eas.json, klasör yapısı | 1 saat |
| **F2** | supabase client, AuthProvider, theme, i18n, providers tree | 2 saat |
| **F3** | Auth ekranları (welcome, phone, otp, profile-setup) + drivermesh.webp backdrop | 3 saat |
| **F4** | Migration SQL'leri: dropoff nullable, RLS politikaları, `request_ride` RPC | 1 saat |
| **F5** | Tabs layout + home idle + vehicles list + account | 3 saat |
| **F6** | CallModal + ride_search_vehicles RPC + request_ride çağrısı + bekleme UI | 2 saat |
| **F7** | Home active state: harita + araç entrance animasyon + status banner + Realtime | 4 saat |
| **F8** | Rating modal + complete flow | 1 saat |
| **F9** | Edit profile + trip detail + help (SSS + form) | 3 saat |
| **F10** | Push notification: token register + send-push entegrasyon + permission flow | 2 saat |
| **F11** | EAS build profile + GitHub Actions workflow + .env.example | 1 saat |
| **F12** | Doğrulama: web preview + cold start ölçüm + perf bütçe doğrula | 2 saat |

**Toplam ≈ 25 saat aktif implementation.** Faz F4'te DB migration uygulanır; F6'da fleet sahibi/admin tarafından en az 1 fleet için `fleets_visibility` seed gerekli (aşağıda).

Aşağıdaki 16-20 numaralı section'lar fazlara dağıtık olarak işlenir, ekstra süre +2 saat tahmini (toplam ~27 saat).

---

## 16. Error handling stratejisi

| Katman | Davranış |
|---|---|
| **React Error Boundary** | `app/_layout.tsx` root'ta. Component tree crash → fallback ekran ("Bir şeyler ters gitti, tekrar dene"). Sentry yok ama `console.error` + AsyncStorage'da son crash log'u (debug için). |
| **TanStack Query — query error** | Query fonksiyonları throw eder. `query.error` → ekranda inline error mesajı + "Tekrar dene" buton. Default retry 3 kez exponential backoff. |
| **TanStack Query — mutation error** | `onError` callback'i → `Toast.show('error', mappedMessage)`. Mutation'larda `retry: false` (idempotent değil). |
| **Error code mapping (i18n)** | `T1` phone format, `T2` rate limit (OTP), `T3` vehicle taken, `T4` customer blocked, `T5` GPS yok, `T6` fleet ride_enabled değil, `T7` aktif yolculuğun var. Her birinin TR/EN karşılığı `i18n/errors.ts`'te. |
| **Auth expired** | Supabase token refresh fail → AuthProvider auto sign-out + Welcome'a yönlen + toast "Oturum süresi doldu". |
| **RLS denied** | "Yetkin yok" toast + console log. Genelde olmaması gereken durum; user-facing log incidence. |
| **Network error** | NetInfo listener (Section 17). |

---

## 17. Offline davranışı

- **`@react-native-community/netinfo`** entegre.
- **Offline banner:** sticky top "İnternet bağlantın yok. Bazı özellikler çalışmayabilir." (slide-down, kalıcı, online dönünce 2sn yeşil "Bağlantı kuruldu" sonra kaybolur)
- **Cache okuma:** TanStack Query persister AsyncStorage'tan stale data render eder (stale-while-revalidate). Müşteri eski stats ve son yolculuğu görür.
- **Mutation davranışı:** offline iken `request_ride`, `cancel_ride`, `submit_rating` mutation'ları **başarısız olur**. Toast "İnternet yok, tekrar dene" + manual retry. Otomatik queue/replay **V2**.
- **Realtime:** Supabase channel otomatik reconnect (built-in). Reconnect'te active ride status manuel `refetch`.
- **GPS aktif ama internet yok:** Vehicles tab boş state, "İnternet yok, tekrar bağlanınca araçlar gelecek".

---

## 18. Force update

Fleet'in mevcut `app_versions` tablosu **ride için de kullanılır**. Tablo zaten `platform IN ('android','ios')` satırlarını destekler — ride versiyonu için ayrı tablo satırı eklemeye gerek yok eğer fleet ile ride'ın store version'ları senkron tutulursa. Veya `app_versions.platform`'a 'android-ride'/'ios-ride' gibi ek satırlar eklenir (migration ile schema değiştirmeden).

**Karar:** V1 için fleet'in mevcut `app_versions` satırlarını paylaşırlar (basit). Senkron kalmazlarsa Migration M8: `app_versions` platform'una compound key (`platform`, `app`) eklenir.

**Davranış:**
- Cold start: `_layout.tsx` provider tree içinde `useForceUpdateCheck()` hook
- Cihaz `current_version` < `min_supported_version` (semver compare) → `ForceUpdateModal` (kapatılamaz, blur backdrop, "Mağazadan güncelle" CTA → `store_url`)
- AppState 'active' transition (foreground'a geçiş) → tekrar kontrol
- Cache: AsyncStorage'da son kontrol zamanı, 1 saat içinde tekrar sorgu yok (cold start hızı için)
- Opsiyonel: `latest_version` > current ama soft (minimum'un üstünde) → in-app "Yeni sürüm var" toast, kullanıcı kapatabilir
- `release_notes_tr` / `release_notes_en` modal'da expand edilebilir (opsiyonel)

---

## 19. Notification permission flow

**Zorla permission prompt YOK ilk girişte** (Welcome → Phone → OTP → Profile Setup → Home → permission sorma). Bu agresif UX, kullanıcı reddederse iki türlü zor olur (sonra istek zor).

**Contextual permission:**
- İlk **"Çağır"** butonu basıldığında: pre-permission rationale modal "Şoförün yola çıktığında, geldiğinde haberdar olmak için bildirim iznine ihtiyacımız var. İzin ver?" → "İzin ver" CTA → `expo-notifications.requestPermissionsAsync()` sistem pop-up
- Sistem pop-up'ında reddedilirse: kayıtsız devam, çağrı yine olur ama push gelmez (kullanıcı app'ı açık tutmazsa şoför durumunu bilemez)
- Account → "Bildirimler" satırı: durum gösterilir ("Açık / Kapalı"). Kapalıysa "Aç" CTA → `Linking.openSettings()`

**Token register:**
- Permission alındığında `expo-notifications.getDevicePushTokenAsync()` → token
- `customers` UPDATE: `push_token`, `push_platform` (`'fcm'` Android, `'apns'` iOS), `push_token_updated_at = now()`
- AppState 'active' transition'da permission re-check (kullanıcı sistem ayarlarından açtıysa token otomatik kayıt)
- Logout: `customers.push_token = NULL` (silinen oturuma push gitmesin)

---

## 20. Pending rating

Müşteri ride complete sonrası rating ekranını "Sonra" ile atlarsa:
- `ride_requests.status='completed'` kalır, `ratings` satırı yok
- Home idle state'in **en üstünde sticky kart**: "Son yolculuğunu değerlendir →" (turuncu accent, küçük yıldız ikonu) — tap → Rating ekranı
- Stats kart üstüne ayrı 1 satır banner: "1 yolculuk değerlendirme bekliyor" (sm muted text)
- Bekleyen rating sorgusu: `SELECT id FROM ride_requests WHERE customer_id = me AND status = 'completed' AND id NOT IN (SELECT ride_request_id FROM ratings WHERE rater_id = my_customer_id) ORDER BY completed_at DESC LIMIT 1`
- 24 saat sonra hatırlatma kartı **otomatik kaybolur** (rating skip kabul edilir; sticky kart artık görünmez ama Trip Detail'dan yine değerlendirilebilir)
- `ratings` tablosunda "skip" durumu yok — sadece varlık/yokluk durumuyla yönetilir

---

# Ek A — Fleet'te yapılması gereken değişiklikler

**BU PR'DA YAPMIYORUZ.** Sadece not. İmplementasyon sırasında veya sonra ayrı PR olarak.

### A1. fleets_visibility seed verisi (KRİTİK)
- Şu an `fleets_visibility` 0 satır → hiçbir fleet `ride_enabled=true` değil
- Ride app'ta müşteri vehicles tab'ında **hiç araç göremeyecek** (boş state)
- **Çözüm seçenekleri:**
  1. **Admin SQL:** Fleet sahipleri için manuel `INSERT INTO fleets_visibility (organization_id, ride_enabled, service_area, city) VALUES (...)` (en hızlı, test için yeterli)
  2. **Fleet UI feature:** Owner ekranında "Ride entegrasyonunu aç" toggle + service_area harita seçici + city dropdown (fleet'e ekleme gerek — kullanıcı kararıyla yapılır)
  3. **Trigger:** Yeni org oluşturulurken otomatik `fleets_visibility` satırı (ride_enabled=false default) — fleet'in mevcut org create RPC'sine eklenir

**V1 önerisi:** A1.1 (admin SQL) ile test verisi seed et, sonra A1.2 (UI feature) için ayrı PR planla.

### A2. Şoförün "vardım/başla/bitir" aksiyonları
- Mevcut fleet jobs sisteminde bunlar var (`assigned_at`, `started_at`, `completed_at`)
- `ride_requests` paralel kolonlar var (`assigned_at`, `arrived_at`, `started_at`, `completed_at`)
- Şoförün fleet app'ında ride_requests'in `arrived_at` ve `started_at`'ını güncelleyen butonlar VAR MI? **Kontrol edilmeli.**
- Yoksa fleet'e eklenmeli (fleet UI değişikliği) veya `jobs` üzerinden trigger ile `ride_requests` sync edilmeli

**V1 risk:** Eğer fleet şoför app'ı `ride_requests` status'unu güncellemiyorsa, müşteri push'ları (driver_arrived, completed) hiç gelmez. **Bu fleet developer'a sorulmalı.** Geçici çözüm: jobs.status update → ride_requests trigger ile sync (DB-level, fleet code'una dokunmadan).

### A3. send-push Edge Function'ın ride event'leri için payload
- `send-push` zaten var; kontrolü: customer için `push_token` + `push_platform` ('fcm'/'apns') kullanıyor mu, profiles için olduğu gibi (`'android'/'ios'`) mu?
- Schema farklı: customers `push_platform = 'fcm'/'apns'`, profiles `push_platform = 'android'/'ios'`
- `send-push` her ikisini handle ediyor olabilir; **kontrol edilmeli**, gerekirse minor patch (Edge function, fleet UI'sını etkilemez)

---

# Ek B — İki proje entegrasyon notları

### B1. Aynı DB, ayrı entity'ler
- `auth.users` ortak
- `profiles` fleet'in, `customers` ride'ın
- Bir kişi teorik olarak ikisinde de olabilir; UI bağlamı belirler hangisi okunur

### B2. Köprü tablolar
- `ride_requests.job_id` → fleet jobs sisteminde projection (V1'de boş, V2'de fleet ride'ı kabul edince jobs satırı oluşur — trigger)
- `ride_requests.driver_id` → profiles.id (driver fleet entity'si)
- `ride_requests.vehicle_id` → vehicles.id (fleet entity'si)
- `ride_requests.organization_id` → organizations.id

### B3. Real-time köprü
- Fleet şoförü mobil app'ı `ride_requests` UPDATE'leri ile durumu değiştirir
- Ride müşteri app'ı `ride_requests.id` channel'ında subscribe eder
- DB trigger her status değişiminde `send-push` Edge Function'ı çağırır

### B4. Hangi RPC'leri ride çağırır?
- `request_ride(vehicle_id, pickup_point, pickup_address)` → yeni, M7 migration
- `ride_search_vehicles(lat, lng, city?)` → yeni, M6 migration
- `cancel_ride(ride_id)` → yeni, basit UPDATE status
- `submit_rating(ride_id, stars, comment)` → yeni veya direkt INSERT

### B5. Hangi Edge Function'ları ride çağırır?
- `send-push` — push gönderme (V1 trigger'dan, app değil)
- `send-support-message` — Help formu
- `ride-quote` — **V1'de değil** (dropoff yok)
- `directions` — **V1'de değil** (rota gösterimi yok V1, dekoratif animasyon)

### B6. Fleet'in haberi olmadan ride app yaşar mı?
- Müşteri çağırır, fleet şoförü push alır, fleet UI'sında işi görür, kabul eder, fleet'te "vardım/başla/bitir" butonlarını basar (eğer varsa) — bu fleet'in mevcut iş akışı mantığına bağlı
- Eğer fleet ride_requests'i hiç görmüyorsa (mesela fleet UI sadece jobs tablosunu listeliyorsa), o zaman fleet'e ride feature eklemek gerekir
- **Geçici çözüm:** `jobs` ↔ `ride_requests` arası trigger ile sync (fleet mevcut UI'sını kullanır, ride bunu trigger ile dinler)

### B7. Test stratejisi
- Önce DB-level migration uygula (M1-M7)
- Fleet'in en az 1 org'u için `fleets_visibility` seed
- Vehicles tablosunda en az 1 araç `status='idle' + current_user_id IS NOT NULL` olmalı (driver claim'li)
- Fleet'te bir şoförü manuel olarak araç üstüne al (vehicleClaim)
- Ride app'ından test müşteri ile çağır
- Şoför fleet'te kabul (eğer UI varsa) veya manuel `UPDATE ride_requests SET status='in_progress'` SQL

---

# Ek C — Açık konular / sonraki kararlar

1. **Fleet UI ride_enabled toggle ne zaman yapılacak?** V1 sonra ayrı PR.
2. **Şoför kabul etme UI fleet'te var mı?** Kontrol gerek — E2E test (2026-05-16) gösterdi ki driver-side ride lifecycle UI (vardım/başlat/tamamla) ve RPC'leri (driver_arrived, start_ride, complete_ride) V1'de YOK. Müşteri tarafı `request_ride`/`cancel_ride`/`submit_rating` ile sınırlı. State geçişleri test'te SQL UPDATE ile simüle edildi.
3. **ride_offers matching algoritması** V2 — şu an spesifik araç seçimi.
4. **Çoklu şehir/PostGIS service_area** V2 — V1 basit reverse-geocode il adı.
5. **Card payment** V2 — V1 cash only.
6. **Notifications history ekranı** V2 — `customer_notifications` tablosu hazır, UI yok.

---

# Addendum — Araç sahiplenme, kullanıcı status'u, mesai saatleri (2026-05-16)

E2E test sonucu (2026-05-16) gösterdi ki `ride_search_vehicles` mevcut hali her idle aracı gösteriyor; gerçek operasyon kuralları daha sıkı. Yeni gereksinimler ayrı bir spec dökümanına yazıldı:

**Bkz:** [`2026-05-16-ride-availability-rules.md`](2026-05-16-ride-availability-rules.md)

Özet kurallar:
- **Vehicle sahiplik:** Araç create'inde `current_user_id = auth.uid()` (owner). Sonradan herkes `claim_vehicle(p_vehicle_id)` RPC ile kendine alabilir. Bir şoför N araç üstünde olabilir. Aktif ride'lı araç başkasınca claim edilemez (T8). Bakımdaki araç claim edilemez (T9).
- **Profile status:** Yeni `profiles.status` enum kolonu (`active | break | off_duty | on_trip | unavailable`). `set_my_status(p_status)` RPC ile UI'dan değiştirilir. Active ride başlarken sistem `on_trip` set eder; bittiğinde pre-trip status'a döner. `on_trip` manuel set edilemez (T10).
- **Operating hours:** `fleets_visibility.operating_hours` jsonb formatı `{"tz":"...","mon":[{"start":"HH:MM","end":"HH:MM"}],...}`. `is_fleet_open(org_id, at)` helper. `operating_hours IS NULL` → 7/24 açık.
- **ride_search_vehicles güncellenmiş filtreler:**
  1. fleet ride_enabled
  2. is_fleet_open
  3. current_user_id IS NOT NULL
  4. **current_user.role = 'driver'** (yeni — owner üstündeki araç ride'da gizli)
  5. **current_user.status = 'active'** (yeni)
  6. maintenance_started_at IS NULL
  7. **vehicle aktif ride'da DEĞİL** (NOT EXISTS subquery, yeni)
  8. service_area içinde

Fleet UI değişiklikleri:
- Anasayfa dil seçici altında **status pill** + bottom-sheet seçici (Aktif/Mola/Mesai Dışı/Müsait Değil).
- Vehicle list/detail "Üzerine Al" butonu (claim).
- Vehicle kartında "Üzerinde: <ad>" badge.
- Status counter yeniden hesaplandı: "aktif (ride'da) · müsait (driver+active) · boşta (owner üstünde veya driver non-active) · bakımda".

Test kapsamı: [`TESTING.md`](../../TESTING.md) §15-16 (Case 9-17 + RPC unit testler).
