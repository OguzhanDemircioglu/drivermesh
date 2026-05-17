# DriverMesh — App Store / Play Store Release Checklist

> Bu liste DriverMesh'in iOS App Store ve Google Play Store'a yayına çıkmasından önce kontrol edilmesi gereken maddeleri içerir. Her release'te baştan geçilmeli. Madde önündeki `[ ]` işaretlerini tamamlandıkça `[x]` ile değiştir.
>
> **Kullanım**: Önce **Faz 1 (release blocker)** kalemleri yeşile döndürmeden mağazaya submit etme. Faz 2–6 zorunlu ama bazıları post-launch'a kayabilir. Notes bölümünde DriverMesh'e özel durumlar belirtildi.
>
> **Son güncelleme**: 2026-05-13
>
> **Track**: Şu an **Android-only deploy** (iOS Apple Developer üyeliği alınana kadar ertelendi — bkz [`memory/project_android_only_track.md`](../../memory/project_android_only_track.md)). iOS işaretli `[ DEFERRED ]` maddeleri Android submission için blocker DEĞİL.

---

## Faz 1 — Release Blocker (Güvenlik & Backend)

### Güvenlik & Secret Hijyeni

- [x] **`create-test-owner` Edge Function'ı sil veya disable et.** — v3 503 disabled stub deploy edildi (2026-05-13). Geri almak için git history'den v2 deploy.
- [x] **`send-push` caller-recipient org match** — v4 deploy edildi (2026-05-13): caller JWT'sinden user id, profiles join'le org karşılaştırma. Service role bearer (cron) skip auth. Forbidden cross-org → 403.

### Cron auto-checkout migration

- [x] **`maintenance_auto_checkout()` RPC retire + maintenance-cron Edge Function migration** — 2026-05-13: Supabase'de `cron.job` `maintenance-auto-checkout` ekli + `vault.secrets.cron_secret` set + `maintenance-cron` Edge Function v2 verify_jwt:false ACTIVE. Test pending: vehicle insert + `maintenance_until = NOW() - 1m` ile end-to-end doğrulama. Hazırlanan artefaktların referansı:
  - **`maintenance-cron` Edge Function** (v1, `verify_jwt:false`) — query param `?s={cron_secret}` ile auth, `Deno.env.SUPABASE_SERVICE_ROLE_KEY` ile send-push v4'ü tetikler.
  - **`set_vault_secret` SECURITY DEFINER RPC** — vault'a secret yazma helper, service_role only.
  - **Bekleyen SQL migration** (`cron_via_edge_function_with_cron_secret`):
    1. `vault.secrets` içine `cron_secret` (random 64-char hex) yaz
    2. `public.maintenance_cron_invoke()` RPC: vault'tan secret oku + `extensions.http_post` ile edge function'a tetik
    3. Eski pg_cron `maintenance-auto-checkout` job sil + yeni schedule: `* * * * *` `SELECT maintenance_cron_invoke()`
    4. Eski `public.maintenance_auto_checkout()` RPC drop
  - **Uygulamak için**: `apply_migration` MCP komutunu Supabase Dashboard SQL Editor'de manuel çalıştır (yukardaki 4 adım tek transaction'da).
  - **Çalıştığı doğrula**: 1-2 dakika sonra Supabase Logs'ta `maintenance-cron` invocation gör + bakım maintenance_until'i geçmiş bir araç ile test (vehicle insert + `maintenance_until = NOW() - interval '1 minute'`).
- [ ] **`cloudinary-sign` / `cloudinary-destroy`** rate-limit + caller auth audit.
- [ ] **`.env`, `android/local.properties`, `*.keystore`** dosyalarının `.gitignore`'da olduğunu doğrula. `git log --all -- .env` ile geçmişte commit edilmediğini kontrol et.
- [ ] **`google-services.json`** commit edildiyse Firebase Console'da API key kısıtlaması koy: Android package `com.drivermesh.android` + release keystore SHA1.
- [ ] **Maps API key** Android'de package+SHA1, iOS'da bundle ID ile kısıtlanmış olmalı (Google Cloud Console → APIs & Services → Credentials → API key restrictions).
- [ ] **Vault secret audit** — `fcm_service_account_json` zaten Vault'ta. Eklenmeli:
  - `cloudinary_api_secret`
  - `telegram_default_bot_token` (per-org bot stratejisine geçilene kadar)
- [ ] **Telegram bot** — memory'deki test bot (`8594702070:...`) sadece geliştirici hesabı. Prod kullanıcıları için organization-level bot token sistemi (her org kendi botunu girer) veya merkezi prod bot.
- [ ] **service_role key** sadece Edge Function ortamında, repo'da hiçbir yerde olmamalı.
- [ ] **Supabase JWT secret** rotasyon planı (compromise scenario için).

### RLS & Backend

- [ ] **RLS politika audit** — şu tabloların hepsinde RLS açık + politika test edilmiş:
  - `profiles`, `organizations`, `vehicles`, `jobs`, `notifications`, `vehicle_assignments`, `maintenance_requests`, `permission_grants`, `member_permissions`
- [ ] **Hierarchy Phase 2** — manager kendi şoförlerinin verisini görür, başka manager'ınkini görmez. Şu an Phase 1 (sadece schema, RLS henüz scope filter yapmıyor).
- [ ] **`SECURITY DEFINER` audit** — `claim_vehicle`, `release_vehicle`, `get_vault_secret`, maintenance auto-checkout cron fn, vs. her birinde:
  - `set search_path = public, pg_temp`
  - `revoke execute from public`
  - `grant execute to authenticated` (gerekenler için)
- [ ] **DB backup** — Supabase Pro plan + PITR aktif, retention en az 7 gün.
- [ ] **Üretim indeks audit** (yavaş query'leri önle):
  - `notifications(recipient_id, created_at desc)`
  - `vehicles(organization_id, status)`
  - `jobs(driver_id, status)`, `jobs(organization_id, created_at)`
  - `vehicle_assignments(vehicle_id, released_at)`
  - `maintenance_requests(vehicle_id, status)`
- [ ] **Cron job audit** — `pg_cron` job'ları idempotent mi (aynı dakika 2 defa çalışırsa duplicate üretmiyor mu).

### Mobile Build & Signing

- [x] **Android prod keystore** oluşturuldu (2026-05-13) — RSA 2048 / SHA384withRSA / 27 yıl validity / alias `drivermesh-release`. Detaylar: [`memory/project_release_keystore.md`](../../memory/project_release_keystore.md). Parola: kullanıcı 1Password'a kaydetti + `android/local.properties`'te (gitignored).
- [x] `android/app/build.gradle` `signingConfigs.release` block'u local.properties'ten okuyor; release build type prod keystore'a bağlı (eksikse debug fallback).
- [x] **ProGuard/R8 enable** — `gradle.properties`'e `android.enableMinifyInReleaseBuilds=true` (2026-05-13).
- [x] **`android.enableShrinkResourcesInReleaseBuilds=true`** (2026-05-13).
- [x] **`versionCode 1`**, **`versionName "1.0.0"`** ilk release için (`app.json` + `android/app/build.gradle`).
- [ ] **AAB build doğrulama** — `./gradlew bundleRelease` ile signed AAB üretildi mi, `apksigner verify` ile prod keystore imzası doğrulandı mı? (in progress 2026-05-13)
- [ ] **Play App Signing** kurulumu yapılmış (Play Console'da, Internal Testing track'inde upload key olarak release.keystore yüklenecek).
- [ ] **Google Cloud Maps API key** Android restriction'a `com.drivermesh.android + SHA1 E7:6B:9F:AC:D7:89:FF:F0:5A:18:C7:44:FD:D2:35:2B:76:4B:83:37` eklenmeli (release build'de Maps tile yüklenmesi için).
- [ ] **Firebase Console** → DriverMesh project → Android app → SHA-1 fingerprint ekle (yeni release SHA1 yukarıda; FCM push çalışması için zorunlu DEĞİL ama Crashlytics ve Sign-In gibi feature'lar için gerekli).
- [ ] [ DEFERRED ] **iOS push** kurulumu — Apple Developer üyeliği alınınca: APNs key + Firebase iOS app + Mac/EAS build. (bkz `memory/project_android_only_track.md`)
- [ ] [ DEFERRED ] **iOS prod signing certificate** + provisioning profile.
- [x] **Bundle ID kararı** — `com.drivermesh.android` (Android), `com.drivermesh.ios` (iOS, app.json'da yer tutucu, Apple Developer hesabında reserve etme adımı iOS açıldığında).

---

## Faz 2 — Politika, Privacy, Permissions

### Permissions Justification

- [ ] **AndroidManifest** her permission için `tools:remove` veya açıklama:
  - `ACCESS_FINE_LOCATION` — "Şoför rotalama ve müşteri eşleşmesi"
  - `CAMERA` — "Araç fotoğrafı çekmek için"
  - `POST_NOTIFICATIONS` — "Yeni iş, bakım onayı bildirimleri"
- [ ] **iOS Info.plist NSUsageDescription** her permission için TR + EN (Localizable.strings + InfoPlist.strings):
  - `NSLocationWhenInUseUsageDescription`
  - `NSLocationAlwaysAndWhenInUseUsageDescription` (eğer background location varsa)
  - `NSCameraUsageDescription`
  - `NSPhotoLibraryUsageDescription`
  - `NSUserNotificationsUsageDescription` (iOS 14+ için opsiyonel)

### Privacy & Yasal

- [ ] **Privacy Policy URL** — hosted (`drivermesh.com/privacy` veya benzeri). İçerik: hangi veri toplanıyor, neden, kimle paylaşılıyor, kullanıcı hakları (KVKK + GDPR).
- [ ] **Terms of Service URL** — hosted.
- [ ] **Account deletion** — uygulama içinden hesap silme akışı **her iki store da zorunlu**:
  - Hesap → Hesabı Sil
  - Confirmation dialog
  - Soft delete (`deleted_at` + 30 gün retention) veya hard delete
  - Sileninse RLS ile gizlenir, ilişkili veriler ne olur kararı net olmalı (yetim job'lar, vs.)
- [ ] **Data Safety form (Play Console)** doldurulmuş:
  - Konum (precise, in-use)
  - Kamera
  - E-posta, isim, telefon (account info)
  - Push token (app activity)
  - 3rd party sharing: Cloudinary (foto), Google Maps (konum), FCM (token)
- [ ] **Privacy Nutrition Label (App Store Connect)** aynı şekilde.
- [ ] **Age rating** — IARC questionnaire (Play) + App Store Age Rating. Tahmini 16+ veya 17+ (lokasyon paylaşımı sebebiyle).

---

## Faz 3 — UX & Kalite

### Hata & Boş Durumlar

- [ ] **Offline empty states** — ağsız açılınca crash değil, "İnternet yok, tekrar deneyin" CTA.
- [ ] **Loading states** tüm async aksiyonlarda (map yüklenme, jobs list, vehicle photo upload).
- [ ] **Error toast/banner** standardı — kullanıcıya teknik hata değil anlamlı mesaj göster.
- [ ] **Network reachability** — `NetInfo` ile global banner (üst kısımda "Bağlantı yok").

### i18n

- [ ] **Hardcoded TR audit** — `[ığüşöçİĞÜŞÖÇ]` grep `app/` ve `src/` altında, `locales/` ve `demo/` hariç. Memory'deki open_gaps item 4.
- [ ] **TR ↔ EN switch** her ekranda manuel test, eksik key var mı (i18next missing key warn).
- [ ] **Title case convention** korunmuş mu (`project_i18n_title_case.md` memory'ye göre).

### Erişilebilirlik

- [ ] **Dokunma alanları ≥ 44pt** (WCAG 2.2 Target Size Minimum, store reject sebebi olabilir).
- [ ] **Renk kontrastı** ≥ 4.5:1 normal text, ≥ 3:1 büyük text — harita pill düzeltmeleri yapıldı, başka yerler audit.
- [ ] **Screen reader** test — TalkBack (Android) + VoiceOver (iOS) ile temel akış.
- [ ] **Dynamic type** — iOS sistem font size değişince UI bozulmasın.

### Permission Akışları

- [ ] **Push permission denied** path — uygulama çalışmaya devam etsin, "Bildirimlere izin verin" CTA.
- [ ] **Konum permission denied** path — harita ekranı boş kalmasın, açıklayıcı state + tekrar isteme.
- [ ] **Kamera permission denied** path — galeri seçenek olarak kalır.

### Operasyonel UX

- [ ] **Force update** mekanizması — DB'de `app_min_version` veya Remote Config + uygulama açılışında check. Eski versiyonlar API breaking change'lerde patlamasın.
- [ ] **Auth session expired** path — refresh token başarısız olursa graceful logout + login ekranı.
- [ ] **Logout** her zaman erişilebilir (Hesap ekranından).

---

## Faz 4 — Test & QA

### Crash & Monitoring

- [x] **Sentry React Native v8** kurulu (2026-05-13) — `@sentry/react-native@^8.11.1`, JS init `src/lib/sentry.ts` + `app/_layout.tsx` module-load. DSN `o4511316582662144.ingest.de.sentry.io` (EU region), org `drivermesh`, project slug **`react-native`** (Sentry'nin auto-suggest ettiği, dashboard'tan rename edilebilir). Demo mode event'leri `demo:true` tag'i ile ayrılır.
- [x] **Source map upload pipeline** — `metro.config.js` `getSentryExpoConfig` ile sarıldı (Hermes source map ayrık), `android/app/build.gradle`'a `sentry.gradle` apply eklendi (assembleRelease sırasında otomatik upload), `app.json` plugins'e `@sentry/react-native/expo` (prebuild idempotent), `android/sentry.properties` (gitignored, defaults.org/project), `SENTRY_AUTH_TOKEN` build env'inden okunur. **Doğrulama**: ilk release build sonrası Sentry dashboard → Releases → drivermesh@1.0.0 source maps görünmeli.
- [ ] **iOS Sentry native** [ DEFERRED ] — Cocoapods setup, iOS açıldığında.
- [ ] **User feedback / shake-to-report** (opsiyonel, nice-to-have).

### Cihaz Matrisi

- [ ] **Düşük-end Android** — 4GB RAM, Android 11, Snapdragon 4xx benzeri.
- [ ] [ DEFERRED ] **Eski iPhone** — iPhone SE (2nd gen) / iPhone 8.
- [ ] **Android tablet** — layout bozulması var mı (`expo-router` Stack vs Drawer fallback). [ DEFERRED ] iPad — iOS açıldığında.
- [ ] **Yavaş ağ** — Chrome DevTools 3G throttle, ya da `adb shell tc qdisc add dev wlan0 root netem delay 500ms`.

### Otomatik Test

- [ ] **Pre-launch report** (Play Console) — robotik test, uyarıları çöz.
- [ ] **TestFlight beta** (iOS) — kapalı grup, gerçek kullanıcı feedback.

### Performans

- [ ] **Cold start** < 2.5s (Android profileable build ile ölçüm).
- [ ] **Bundle boyutu** AAB ~30-40MB hedef. `./gradlew bundleRelease` sonrası AAB inspect.
- [ ] **Memory profil** — 100MB üstünde uzun süreli sızıntı yok.
- [ ] **ANR rate** Play Console'da %0.47 altı (Android Vitals badge'i için).

### Akış Test (TESTING.md referansı)

- [ ] Smoke test — uygulama açılıyor, login, çıkış.
- [ ] Auth — register, login, password reset, account deletion.
- [ ] Vehicle — create, edit, photo upload (signed Cloudinary), delete, claim/release.
- [ ] Maintenance — request, approve, reject, start, end, cron auto-checkout.
- [ ] Job — create, assign, start, complete, cancel.
- [ ] Push — 14 notification tipi (TESTING.md'deki liste), app içi list (send-push v3 ile).
- [ ] Permissions — owner→manager→driver akışları.
- [ ] Maps — konum izni, vehicle marker, route directions.

---

## Faz 5 — Store Metadata

- [ ] **App icon** — adaptive (Android foreground + background), iOS 1024×1024 (no alpha).
- [ ] **Screenshots**:
  - **Android**: telefon 16:9 ve 9:16 (en az 2, max 8). Çift dil için TR + EN ayrı set.
  - **iOS**: 6.7" (iPhone 15 Pro Max), 6.5" (iPhone 11 Pro Max), 5.5" (iPhone 8 Plus). İsteğe bağlı iPad.
- [ ] **Feature graphic (Play)** — 1024×500 PNG.
- [ ] **App description**:
  - **Kısa açıklama** (Play 80 char, App Store subtitle 30 char)
  - **Uzun açıklama** (Play 4000 char, App Store 4000 char) — TR + EN
- [ ] **Keywords (iOS)** — 100 char, virgülle ayrılmış.
- [ ] **Kategori** — Business / Productivity.
- [ ] **Support URL + e-mail** — kullanıcıların ulaşabileceği canlı kanal.
- [ ] **Marketing URL** (opsiyonel).
- [ ] **Test account credentials** — review'cular için tek bir patron + şoför hesabı, sandbox org. App Review Notes'a yaz.
- [ ] **Promo video** (opsiyonel) — 15-30s YouTube/App Preview.

---

## Faz 6 — Operasyonel (Post-Launch Hazırlığı)

- [ ] **Maintenance cron canlı test** — vehicle insert + `maintenance_until` past → 1 dakika içinde `maintenance_overdue` push + app içi liste kaydı.
- [ ] **Edge Function log monitoring** — Supabase dashboard'tan baz alma, alarm kuralı.
- [ ] **Database connection pooling** — Supabase Pro pooler (port 6543) production'da kullan.
- [ ] **send-push deep-link** — push'a tıklayınca ilgili ekrana git (`notification_id` data payload'ında var, app'in deep-link handler'ı kullanmalı).
- [ ] **Rate limiting** kritik endpoint'lerde — Edge Function `Deno.serve` içinde IP/user-bazlı limit.
- [ ] **Cloudinary usage alarm** — quota dolmadan önce uyarı.
- [ ] **Push token cleanup** — uninstall'da FCM 404 alıyoruz, profile token null'a düşüyor (zaten v3'te var). Periyodik audit cron.

---

## Go / No-Go Karar Matrisi

| Kategori | Durum | Karar |
|---|---|---|
| Faz 1 — Güvenlik / RLS / Build | Tüm `[ ]` → `[x]` | **Hayır → ship etme** |
| Faz 2 — Privacy / Permissions | Tüm `[ ]` → `[x]` | **Hayır → store reject eder** |
| Faz 3 — UX | %80+ tamam | **Yes** (post-launch küçük fix'ler ok) |
| Faz 4 — Test / QA | Crash reporting + smoke test geçti | **Yes** |
| Faz 5 — Metadata | Submit için zorunlu olanlar tam | **Yes** |
| Faz 6 — Operasyonel | Monitoring kurulu | **Yes** |

**Final go**: Faz 1 + 2 %100 + Faz 3-6 minimum geçti → submit.

---

## Notes — DriverMesh'e Özel Risk Noktaları

1. **iOS ertelendi (Android-only track)** — Apple Developer üyeliği ($99/yıl) alınana kadar iOS pipeline kapalı. Bütün iOS-spesifik maddeler `[ DEFERRED ]` etiketli, Android submission için blocker DEĞİL. Detay: [`memory/project_android_only_track.md`](../../memory/project_android_only_track.md).
2. **Demo mode** prod build'de **kapalı olmalı** — `__DEV__` veya environment flag ile gate edilmiş, mağaza versiyonunda görünmemeli. Demo mode'un "5 saniye sonra otomatik giriş" davranışı review'cuları yanıltabilir.
3. **DriverMesh Ride** V0.1 entegrasyonu **yapıldı** (2026-05-17): bağımsız Expo projesi `ride/`, Expo dashboard'da `cray61/drivermeshride`, ilk production AAB `ride-v0.1.2` ile çıktı. Fleet tarafında `source: 'ride'` job source, `claim_vehicle_for_ride` RPC, `app/(app)/driver-ride.tsx` mevcut. Ride ile fleet arasında customer ↔ driver akışı entegre.
4. **Hierarchy Phase 2 RLS** kritik — bir manager başka manager'ın şoförünü görebiliyorsa veri sızıntısı olur, store'a göndermeden önce DB'de simulate et.
5. **Vault secret rotation** planı yaz — secret leak olursa nasıl rotate edilir, hangi servis etkilenir.
6. **Open gaps** (`memory/project_open_gaps.md`) gözden geçir, hangileri release blocker oldu güncelle.
