# DriverMesh — Mimari ve Çalışma Kılavuzu

> Bu doküman DriverMesh fleet uygulamasının nasıl çalıştığını, hangi bileşenlerden oluştuğunu ve modüller arası akışı açıklar. Yeni başlayan geliştiriciler ve ileride entegre edilecek chatbot için referanstır.

---

## 1. Genel Bakış

**DriverMesh**, küçük-orta ölçekli filo operasyonları için bir mobil uygulamadır. Bir filo sahibi (Patron) yöneticileri ve şoförleri davet eder, araç envanterini yönetir, müşteri taşıma işlerini oluşturur ve atar. Şoförler atanan işleri kabul eder, başlatır ve tamamlar. Patron tüm filoyu canlı haritada görür.

**Hedef kullanıcılar:** Türkiye'de 5-50 araçlık şehir-içi lojistik / kurye / nakliye filoları.

**Çekirdek değer önerisi:**
- Tek mobil app içinden filonun kim/nerede/ne yapıyor görünürlüğü
- Telegram/email ile müşteri geri bildirim entegrasyonu
- Demo mode — demo verisi ile uygulamayı tanıtım

---

## 2. Teknoloji Yığını

| Alan | Seçim | Not |
|---|---|---|
| Framework | Expo SDK 54 (React Native 0.81) | new architecture (Fabric) açık |
| Routing | Expo Router 6 (file-based) | `app/` klasör yapısı = ekran ağacı |
| Backend | Supabase (PostgreSQL + Auth + Storage) | RLS politikaları aktif |
| State (auth) | React Context (`AuthProvider`) | session + profile + isDemo |
| State (formlar) | `react-hook-form` + `zod` validation | tüm input formları |
| i18n | `i18next` + `react-i18next` | TR/EN, locale `expo-localization` ile cihaz dilinden okuma |
| Stil | Tema dosyası (`src/theme/index.ts`) — koyu lacivert (#0A0E1F) + turuncu accent (#FF7A1A) | yoktur design-system kütüphanesi |
| Yazı tipi | Noto Sans (Google Fonts, OFL) | `Text.defaultProps.style` ile global |
| Harita | `react-native-maps` + Google Maps SDK | Maps API key build-time inject |
| İkonlar | `@expo/vector-icons` (Feather + MaterialCommunityIcons) | |
| Görsel cache | AsyncStorage tabanlı (`src/lib/imageCache.ts`) | Cloudinary URL → data URI |

---

## 3. Klasör Yapısı

```
drivermesh2/
├── app/                          # Expo Router rotaları
│   ├── _layout.tsx               # Root layout: AuthProvider + AuthGate + fontlar
│   ├── index.tsx                 # Initial redirect
│   ├── (auth)/                   # giriş yapılmamış kullanıcı ekranları
│   │   ├── welcome.tsx
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── redeem.tsx            # davet kodu kullanma
│   └── (app)/                    # giriş yapmış kullanıcı ekranları
│       ├── _layout.tsx           # bottom nav
│       ├── index.tsx             # Ana sayfa (home)
│       ├── notifications.tsx
│       ├── fleet-map.tsx         # filo haritası
│       ├── reports.tsx
│       ├── jobs/
│       │   ├── index.tsx         # iş listesi
│       │   ├── [id].tsx          # iş detay
│       │   ├── new.tsx           # yeni iş
│       │   ├── request.tsx       # şofor self-request iş
│       │   └── edit/[id].tsx     # iş güncelleme (owner/manager)
│       ├── vehicles/
│       │   ├── index.tsx
│       │   ├── [id].tsx
│       │   ├── new.tsx
│       │   └── edit/[id].tsx
│       ├── team/
│       │   ├── index.tsx
│       │   └── invite.tsx
│       ├── permissions/
│       │   ├── index.tsx
│       │   └── [id].tsx
│       └── account/
│           ├── index.tsx
│           ├── edit.tsx
│           ├── hq.tsx            # filo merkezi (HQ) ayarları
│           ├── feedback.tsx      # müşteri geri bildirim kanalları
│           └── support.tsx       # destek formu (Telegram bot)
├── src/
│   ├── auth/                     # auth context + permission helper
│   │   ├── AuthProvider.tsx
│   │   └── useCan.ts
│   ├── components/               # paylaşılan UI öğeleri
│   ├── demo/store.ts             # demo modu in-memory store
│   ├── i18n/                     # locale dosyaları (tr.ts, en.ts)
│   ├── lib/                      # data layer (Supabase client + RPC sarıcılar)
│   │   ├── supabase.ts
│   │   ├── database.types.ts     # Supabase'den generate
│   │   ├── jobs.ts
│   │   ├── vehicles.ts
│   │   ├── permissions.ts
│   │   ├── queries.ts            # cross-table read'ler (fleet map, reports)
│   │   ├── feedback.ts
│   │   ├── support.ts
│   │   ├── invitations.ts
│   │   ├── hq.ts
│   │   ├── imageCache.ts
│   │   └── openInMaps.ts         # native maps app'e yönlendirme
│   └── theme/                    # renk paleti, font, spacing
├── android/                      # Expo prebuild ile generate edilmiş Android proje
├── assets/                       # logo, splash görselleri
└── docs/                         # bu klasör
```

---

## 4. Mimari Katmanlar

DriverMesh üç katmanlı:

```
┌────────────────────────────────────────────────────┐
│  UI: app/ ekranları + src/components/             │  Sunum
├────────────────────────────────────────────────────┤
│  Data: src/lib/ (Supabase RPC + isDemoActive)     │  İş mantığı
├────────────────────────────────────────────────────┤
│  Source: Supabase (canlı) | demo store (mock)      │  Veri
└────────────────────────────────────────────────────┘
```

**Önemli kural:** UI katmanı `src/lib/*`'ı çağırır, doğrudan Supabase client'a dokunmaz. Lib katmanı `isDemoActive()` kontrolü ile demo store'a veya Supabase'e dağıtır. Demo modu UI için saydamdır.

Örnek akış:
```
JobDetailScreen (app/(app)/jobs/[id].tsx)
   │ getJob(id)
   ▼
src/lib/jobs.ts:getJob
   │
   ├─ if isDemoActive() → demo.jobById(id)
   └─ else            → supabase.from('jobs').select(...)
```

---

## 5. Auth ve Profile

**Süreç:** kullanıcı `/(auth)/login` → email+şifre → Supabase auth → session açıldı → `AuthProvider` profile'ı çeker → `AuthGate` `(app)`'a yönlendirir.

**Demo modu:** `AuthProvider.signInDemo()` `activateDemo()` çağırır → demo store'u AsyncStorage'tan yükler veya seed eder → fake bir Supabase session oluşturur → home ekranına gider.

**Roller:** `owner` | `manager` | `driver`. Roller `profiles.role` kolonunda. Owner filoyu kuran kişi. Manager owner tarafından davet edilir, üst düzey operasyon yapar. Driver işleri kabul eder ve teslim eder.

**İzinler (`permissions/`):** her rol için bir `vehicles.view`, `jobs.create` gibi anahtarın varsayılan açık/kapalı durumu var. Owner istediği member için override edebilir. UI'da `useCan('jobs.create')` ile kontrol edilir.

---

## 6. Demo Modu

Demo modu **gerçek Supabase çağrısı yapmadan** uygulamanın canlı çalıştığı görüntüsünü verir.

**Aktivasyon:** Welcome ekranında "Demo App" → `signInDemo()` → `activateDemo()`:
1. AsyncStorage'tan `drivermesh.demo.state.v2` anahtarını oku
2. Varsa hidrate et, yoksa `reseed()` ile seed verisini oluştur
3. `_active = true`, fake session set et

**State:** `src/demo/store.ts` modül-seviyesi singleton object (`state`). 7 demo job, 5 demo vehicle, 5 profil, 1 davet, 3 bildirim. Her mutation `emit()` → 250ms debounced AsyncStorage'a yazma.

**Lib guard'ı:** her data lib fonksiyonunun başında:
```ts
if (isDemoActive()) {
  // demo store ile döndür
  return demo.something();
}
// supabase çağrısı
```

**Kritik kural:** Demo aktifken hiçbir şekilde Supabase'e gidilmez (bkz. `feedback_demo_no_supabase` memory). Bu UI tutarlılığı + güvenlik (demo'da credential leak olmasın) için.

---

## 7. Job (İş) Lifecycle

`jobs.status` enum: `open | assigned | in_progress | completed | failed | cancelled`.

**State machine:**
```
[Owner/Manager creates] ─► open
                           │
                  assignDriver
                           ▼
                       assigned
                           │
                       startJob (driver)
                           ▼
                      in_progress
                           │
                  completeJob / failJob (driver)
                           ▼
                  completed | failed

[Owner cancels at any non-terminal state] ─► cancelled
```

**Self-request:** driver `jobs/request.tsx` ile `source: 'driver_request'` yeni bir job oluşturur (status `open`). Owner/manager bunu `approveDriverRequest`/`rejectDriverRequest` ile karara bağlar.

**Edit:** sadece owner/manager + `jobs.update_any` izni ile. Edit ekranı `app/(app)/jobs/edit/[id].tsx`. Düzenlenebilir alanlar: customer_name, pickup/dropoff (adres + koordinat), distance_km, eta_minutes, notes. **Yan etki:** atanmış driver varsa `notifications` tablosuna `job_update` tipinde bildirim düşer.

**Reassign:** `reassignJob(jobId, driverId | null)` ile şofor değiştirme veya kaldırma.

---

## 8. Vehicle (Araç) Yönetimi

`vehicles` tablo kolonları: `plate`, `brand`, `model`, `year`, `status`, `color` (operatör tercih, hex), `is_at_hq` (parked at HQ), `photo_url`.

**Status:** `active | idle | maintenance`. **Önemli:** UI'dan manuel status değişimi YOKTUR (önceki commit'te kaldırıldı). Status DB-side (job lifecycle trigger veya bakıma alma şu anda yok, gelecek özellik).

**Yeni araç:** `app/(app)/vehicles/new.tsx`. Plaka + marka + model + yıl + (opsiyonel) renk swatch.

**Düzenle:** `app/(app)/vehicles/edit/[id].tsx`. Plaka, marka, model, yıl, renk düzenlenir. Status edit edilemez. `vehicles.update` izni gerek.

**Photo:** Cloudinary'ye signed upload (TODO — `vehicles/new.tsx`'te placeholder).

**HQ marker:** `is_at_hq=true` aracın haritada gizler (HQ ikonu zaten orada). Her dispatch'te otomatik clear olur (gelecek trigger).

---

## 9. Fleet Map (Filo Haritası)

`app/(app)/fleet-map.tsx`, fişoyu canlı (refresh ile) gösterir.

**Veri kaynağı:** `fetchFleetMap(orgId)` (src/lib/queries.ts:fetchFleetMap):
- HQ koord + adres
- Tüm araçlar (plaka, status, color, is_at_hq, position)
- Aktif işler (assigned + in_progress) — her aracın `activeJob` olarak inject edilir

**Render:**
- `LabeledMarker` (plaka pill) — vehicle başına. Pill rengi `v.color ?? vehicleColorFromPlate(v.plate)`.
- `MiniLocationPin` — pickup/dropoff teardrop (ortası beyaz delik). Aktif işler için.
- `Polyline` — pickup→dropoff arası kesik çizgi, **vehicle renginin koyusu** (`darken()` helper). Backing alpha + ana stroke.
- HQ — özel `LabeledMarker variant='hq'` (lavender renk).

**Marker tap dispatch (onMarkerPress):**
| Identifier | Aksiyon |
|---|---|
| `v:${vehicleId}` | `/(app)/vehicles/${id}` (vehicle detayı) |
| `hq` | `openInMaps(hq.lat, hq.lng, address)` (sistem haritası) |
| `p:${vehicleId}` | `openInMaps(pickup, address)` |
| `d:${vehicleId}` | `openInMaps(dropoff, address)` |

**Önemli:** vehicle pill tap'i hep router push, çünkü detay sayfası daha çok bilgi verir; pickup/dropoff/HQ pin'leri ise harita uygulamasında yön tarifi almaya götürür.

**Animasyon:** vehicle pin in-progress sırasında pickup→dropoff arası lineer interpolation ile hareket eder. Sadece JobMiniMap (job detay) için aktif. Fleet-map'te sabit pozisyon (CPU yükü + UX kararı).

---

## 10. JobMiniMap (Job Detay Haritası)

`src/components/JobMiniMap.tsx` — job detayında pickup/dropoff'u gösteren küçük statik harita.

- Polyline pickup→dropoff kesik kırmızı çizgi
- Pickup ve dropoff `MiniLocationPin` (teardrop, ortası delik)
- Vehicle pin (turuncu disc + araba ikonu) `inProgressStartedAt` set ise animasyonla yola oturur
- Pin tap → `openInMaps` (sistem haritası)

**Animasyon detayı:** `useTruckAnimation` hook'u (28 sn cycle, 120ms tick). `tracksViewChanges={tracking}` ilk 1.5sn açık (icon font rasterize), sonra kapalı (flicker önleme).

---

## 11. Notifications

`notifications` tablosu DB-driven event store. UI ekranı `app/(app)/notifications.tsx`.

**Tip listesi (`type` kolonu):**
| Tip | Tetikleyen | Hedef |
|---|---|---|
| `permission_grant` | Owner permission değişikliği | İlgili member |
| `driver_request` | Driver self-request job | Owner |
| `request_approved` | Owner approves driver request | Driver |
| `request_rejected` | Owner rejects | Driver |
| `job_update` | Owner/manager job edit | Atanmış driver |

**Yan etki tetikleyicileri:** `src/lib/jobs.ts:updateJob` içinde `before.driver_id` set ve status `assigned`/`in_progress` ise notification insert.

**Renderer:** her tip için ayrı title/body i18n string + payload (job_id, customer_name, changed_fields). Tap → `router.push` ilgili job detayına.

---

## 12. Permissions Sistemi

`permissions.ts` lib + `app/(app)/permissions/[id].tsx` UI.

- Permission catalog 12 anahtar (vehicles.view, jobs.create vs)
- Her rol için varsayılan açık/kapalı (`ROLE_DEFAULTS`)
- Owner override edebilir → `permissionOverrides` map (memberId → key → boolean)
- UI'da `useCan('jobs.create')` hook'u → `{ allowed, reason }` döner. UI'da disable + tooltip.

---

## 13. Internationalization (i18n)

`src/i18n/locales/tr.ts` ve `en.ts` — tüm UI metinleri burada. `useTranslation()` ile.

**Locale tespit:** ilk açılışta `expo-localization.getLocales()` cihaz dilinden TR/EN seç. Kullanıcı manuel toggle ederse `AsyncStorage('drivermesh.locale')` kalıcı.

**Title case kuralı (`feedback_i18n_title_case` memory):** kısa display string'ler "Title Case" formatında ("Filon Hareket Halinde"), uzun cümleler sentence case (".....").

---

## 14. Theme & UI Kit

`src/theme/index.ts`:
- Renkler: `bg`, `bgElevated`, `text`, `textMuted`, `accent` (#FF7A1A), `mesh` (mavi-mor), `success`, `danger`, `warning`, `lavender`
- Spacing scale: xs..3xl
- Radius: sm..xl
- Font: NotoSans + size scale (xs..4xl)

**Paylaşılan komponentler (`src/components/`):** Button, Card, TextField, Picker, Avatar, ConfirmDialog, Toast, Screen (page wrapper), MeshBackground (decorative bg), CachedImage, Logo, ...

---

## 15. Cross-cutting Konular

### Image Cache Pipeline
Cloudinary URL → AsyncStorage data URI cache. `<CachedImage uri={url} />` ile kullanılır. İlk fetch'te bytes indir + base64 encode + persist. Sonraki render'larda data URI direkt yüklenir, network gerekmez.

### Demo State Persistence
Demo store her mutation'da 250ms debounced disk yazma (`drivermesh.demo.state.v2` AsyncStorage key). Demo'ya tekrar girince state restore.

### Native Maps Integration
`src/lib/openInMaps.ts` helper: iOS'ta `maps://` (Apple Maps), Android'de `geo:` (Google Maps), web fallback `https://www.google.com/maps/search/?api=1&query=...`. Native sistem haritası açılır → kullanıcı kendi tercihindeki uygulamada yön tarifi alır.

### AuthGate Mount Race
Fresh start veya `pm clear` sonrasında Expo Router'ın internal state mount tamamlanmadan `router.replace` çağrılırsa "Attempted to navigate before mounting the Root Layout" hatası tetikleniyordu. `useRootNavigationState()?.key` guard + try/catch silent fail ile çözüldü ([app/_layout.tsx](../app/_layout.tsx)).

---

## 16. Ortam Değişkenleri (.env)

```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=dotcw6tty
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS=...
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID=...
EXPO_PUBLIC_TELEGRAM_SUPPORT_API_KEY=...
EXPO_PUBLIC_TELEGRAM_SUPPORT_CHAT_ID=...
```

`EXPO_PUBLIC_` ön ekiyle olanlar client bundle'a embed edilir. Sırtta tutulan secret'lar (CLOUDINARY_API_SECRET vs) sadece backend / Edge Function'larda kullanılır, client'a sızmaz.

**Maps API key güvenliği:** Google Cloud Console'da:
- Android key → Application Restriction = "Android apps" + package + SHA-1 fingerprint
- iOS key → Application Restriction = "iOS apps" + bundle ID
- API restriction = sadece "Maps SDK for Android/iOS"

---

## 17. Build & Çalıştırma

**Geliştirme:**
```bash
npm install
npm run start            # Metro bundler
npm run android          # APK build + install + Metro deep link
```

**Type check:**
```bash
npm run typecheck
```

**Build için (production):**
- EAS build veya `expo run:android --variant release` (yerel)
- Hermes bytecode + minified bundle → açılış süresi dev'in 3-5 katı hızlı

---

## 18. Yapısal Kararlar (ADR ozetleri)

- **AsyncStorage demo persistence:** demo state app kapatma sonrası saklanır (kullanıcı deneyimi). Reset için account → "Filo Sil" → `clearDemoStorage()`.
- **Status edit disabled:** vehicle status manuel değiştirilemez — gelecek otomatik trigger için yer açıldı (job lifecycle veya maintenance toggle).
- **Animasyon JobMiniMap'te, fleet-map'te yok:** çoklu interval + toplu render yükü vs. Job detayda tek araba animasyonu daha anlamlı.
- **Native maps default:** iOS = Apple Maps, Android = Google Maps. Kullanıcı sistem haritası deneyimini bekliyor.
- **Pin anchor (0.5, 0.5):** Custom Marker'ın render bounds'u Polyline stroke origin'iyle pixel-perfect olmadığı için merkez anchor seçildi.

---

## 19. Hâlâ Açık Olan İş Kalemleri

Aşağıdaki memory dosyasına bakın: [`memory/project_open_gaps.md`](../../.claude/memory/project_open_gaps.md). Özet:
- Operator photo upload for vehicles (Cloudinary signed)
- `expo-file-system` migration for image cache (boyut limiti gelince)
- Hardcoded TR audit (release öncesi)
- Backend RPC'ler (`transferOwnership`, `delete_fleet`)
- DriverMesh Ride entegrasyonu (ayrı app, bkz. ROADMAP)

---

## 20. Dosya Referans Çizelgesi

| Konu | Dosya | Satır |
|---|---|---|
| Auth context | `src/auth/AuthProvider.tsx` | tamamı |
| Auth route guard | `app/_layout.tsx` | `AuthGate` fn |
| Permission hook | `src/auth/useCan.ts` | tamamı |
| Demo store | `src/demo/store.ts` | tamamı |
| Job RPC sarıcılar | `src/lib/jobs.ts` | tamamı |
| Vehicle RPC | `src/lib/vehicles.ts` | tamamı |
| Filo map veri | `src/lib/queries.ts` | `fetchFleetMap` |
| i18n giriş | `src/i18n/index.ts` | tamamı |
| TR locale | `src/i18n/locales/tr.ts` | tamamı |
| EN locale | `src/i18n/locales/en.ts` | tamamı |
| Theme | `src/theme/index.ts` | tamamı |
| Database types | `src/lib/database.types.ts` | Supabase generate |
| Native maps helper | `src/lib/openInMaps.ts` | tamamı |
| Image cache | `src/lib/imageCache.ts` | tamamı |

---

*Doküman Versiyonu: 1.0 — DriverMesh ana mimarisi. Sonraki bölümler: ROADMAP.md (DriverMesh Ride yol haritası), API_REFERENCE.md (modül-modül RPC sarıcı arayüzü), DEMO_DATA.md (demo seed içeriği).*
