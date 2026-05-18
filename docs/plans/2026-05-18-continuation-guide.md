# DriverMesh — Devam Rehberi

> **Tarih:** 2026-05-18
> **Master HEAD:** `091451a`
> **Amaç:** Önceki Claude Code session'ında yapılanların özeti + yeni session'da hızlıca kalınan yerden devam etmek için checklist + komutlar.

---

## 1. Mevcut Durum (Son ~40 Commit Özeti)

### Chatbot V0.1 (yapıldı)
- DB: `chat_sessions` + `chat_messages` + RLS + trigger (`apply_migration` ile uygulandı)
- Edge function: `supabase/functions/chat-bot/` (deployed, ACTIVE)
- AI sağlayıcı: Google Gemini Flash 1.5 primary → Cloudflare Workers AI fallback → hardcoded son çare
- Mobile: `fleet/app/(app)/chatbot.tsx` + `src/chatbot/{types,client,tour,keys}.ts` + `components/ChatBotBadge.tsx`
- Bot avatar: home'da absolute, Kişi Ekle sağ üst çapraz, "Bana Sor" pill (× ile session-içi kapatılabilir)
- Bilgi tabanı: `docs/help/*.md` (6 markdown) inline embedded in `kb.ts`
- Demo modunda mock cevap (`isDemoActive()` guard)

### Demo seed v7
- Key: `drivermesh.demo.state.v7` (AsyncStorage)
- 6 profile, 7 araç, 10 iş, 5 notification
- Profile.status: Ahmet/Burak `on_trip`, Mehmet `break`, Ayşe/Owner/Manager `active`
- Tüm araçlar bir sahibe atanmış (`vehicles_set_default_owner` trigger uyumu)
- Yeni: ride-source jobs (demo-j8 in_progress + demo-j9 completed), driver_request job (demo-j10)
- Yeni: elektrik araç (demo-v6 Renault Trafic E-Tech, Burak'ta)

### UI yenilemeleri
- Welcome ekranı: LOGİN.webp bg, TextField label opsiyonel, Demo App eski hali (floating robot kaldırıldı)
- Home: setup hero kaldırıldı (herkese demo görünümü), absolute AI bot + "Bana Sor" bubble
- Vehicle list: VehicleCard'a "Üzerinde: <ad>" badge + "Üzerine Al" inline CTA
- Ride history ekranı: `app/(app)/ride-history.tsx` + Hesap menü linki
- Status pill driver-only (owner/manager Filo Ritmi'nden zaten görür)

### Build & Release
- Workflow temizliği: `build-android.yml`, `build-android-ride.yml`, `ride-ci.yml` silindi; sadece release tag tetik
- Expo projeleri ayrı: `cray61/drivermesh` (fleet), `cray61/drivermeshride` (ride)
- Tag-based release: `v1.0.1` (fleet) + `ride-v0.1.2` (ride) production AAB build başarılı
- `gen:types` regenerate edildi (Profile.status + chat tables + fleets_visibility)

### CI/CD doc'ları güncellendi
- `docs/fleet/CI_CD_SETUP.md` — master push akışı kaldırıldı, tag-only release
- `docs/fleet/RELEASE_CHECKLIST.md` L240 — ride V0.1 yapıldı notu
- `docs/fleet/ARCHITECTURE.md` L1178 — TODO'dan ride çıkarıldı, chatbot eklendi

---

## 2. Senin Tarafında Bekleyen Manuel Adımlar

### Acil
- [ ] **Google Maps billing aktivasyonu** — Google Cloud Console → Billing. Haritalar şu an "Authorization failure" (hem fleet hem ride)
- [ ] **Chatbot gerçek user testi** — Supabase Edge Function secrets eklendi (`GEMINI_API_KEY`, `CF_API_TOKEN`, `CF_ACCOUNT_ID`), gerçek hesapla soru sor, Gemini cevabını doğrula

### Production Yayın (Play Store)
- [ ] **Privacy Policy URL** — drivermesh.com/privacy host et (KVKK + GDPR)
- [ ] **Terms of Service URL** — drivermesh.com/terms
- [ ] **Account deletion akışı** — Hesap → Hesabı Sil, soft delete + 30 gün retention (Play Store zorunlu)
- [ ] **Data Safety form** (Play Console) — toplanan veri kategorileri
- [ ] **Age rating** — IARC questionnaire (Play) + App Store rating
- [ ] **Screenshots** TR + EN (telefon + tablet aspect)
- [ ] **App description** TR + EN (kısa + uzun)
- [ ] **Telegram support bot prod token** — test bot revoke edildi (memory'de noted)

### iOS (ertelendi)
- [ ] **Apple Developer üyeliği** ($99/yıl) — sonrası iOS pipeline (eas.json'a APPLE_ID/teamId)
- [ ] **APNs key** — iOS push
- [ ] **iOS Sentry native** — Cocoapods setup

### Submission Sonrası
- [ ] Play Console → Internal Testing track → "Promote release" → Closed Beta
- [ ] ~14 gün test → Production
- [ ] Rollout %20 → %100 staged

---

## 3. V0.2 Backlog (Sonraki Iteration)

Yapı zaten kurulu, sadece implement bekliyor:

| Öncelik | İş | Dosya / Hint |
|---|---|---|
| HIGH | Hierarchy Phase 2 RLS | `profiles.manager_id` scope filter — manager kendi şoförlerini görür |
| MEDIUM | Driver ETA canlı güncelleme | Polling 3sn → Supabase Realtime channel |
| MEDIUM | Cancel grace period UI | Ride iptal akışı (V0.1'de yok) |
| MEDIUM | Bot tool use (function calling) | Gemini/Claude function calling — fleet sorgu/aksiyon |
| LOW | Embedding RAG (pgvector) | `chat-bot/kb.ts` keyword → embedding |
| LOW | Ride session listesi (chatbot) | Şu an tek aktif session — geçmiş sohbetler UI |

---

## 4. Bilinen Teknik Borçlar

- **Hardcoded TR audit** — `grep -rE '[ığüşöçİĞÜŞÖÇ]' fleet/app fleet/src` (locales hariç). Memory'de open_gaps item 4
- **WCAG kontrast** — harita pill dışında başka yerler audit edilmedi
- **Sentry source map** — release build sonrası dashboard'da symbolication doğrula (`drivermesh@1.0.0` release altında)
- **Cron auto-checkout canlı test** — `maintenance_until` past vehicle ile 1 dakikalık cron'un push + insert akışı doğrula
- **Maintenance migration** — `maintenance_auto_checkout()` RPC retire + `maintenance-cron` edge function active (RELEASE_CHECKLIST.md'de pending)

---

## 5. Risk Noktaları

- **Demo mode prod build'de açık** — `__DEV__` flag yok; Welcome'da Demo App görünür. Store review'cu yanılabilir
- **service_role key** sadece Edge Function ortamında, repo'da yok (doğru)
- **API key kısıtlamaları** — Maps API'de package+SHA1 restriction (release SHA1 memory'de var)
- **Manager Phase 2 RLS yok** — manager tüm filoyu görür → veri sızıntısı riski (release blocker olabilir)

---

## 6. Sık Kullanılan Komutlar

### Release APK build (Windows, PowerShell)
```powershell
$env:SENTRY_DISABLE_AUTO_UPLOAD = 'true'
Set-Location C:\Projeler\drivermesh\fleet\android
.\gradlew.bat assembleRelease
adb install -r app\build\outputs\apk\release\app-release.apk
```

### Dev APK + Metro (Fast Refresh)
```bash
cd C:/Projeler/drivermesh/fleet
npx expo start --dev-client &
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb reverse tcp:8081 tcp:8081
```

### EAS Build (cloud, Expo dashboard)
```bash
export EXPO_TOKEN=$(grep '^EXPO_EAS_TOKEN=' fleet/.env | cut -d= -f2-)
cd fleet  # veya ride
npx eas-cli build --platform android --profile preview --non-interactive --no-wait
```

### Tag-based release
```bash
git tag v1.0.2 && git push origin v1.0.2          # fleet
git tag ride-v0.1.3 && git push origin ride-v0.1.3  # ride
# GitHub Actions otomatik: EAS production build + Play submit
```

### Demo data reset
```bash
adb shell pm clear com.drivermesh.android
```

### Types regen
```bash
# Supabase CLI ile:
npx supabase gen types typescript --project-id ucitxvsndlwvvnqwabgo > fleet/src/lib/database.types.ts
# Sonra dosya sonuna manuel kısa alias'ları ekle (Job/Vehicle/Profile vb.) — bkz son commit
```

### Cihazda cold start ölçümü
```bash
adb shell am force-stop com.drivermesh.android
adb shell am start -W -n com.drivermesh.android/.MainActivity
# Beklenen: TotalTime <3s release, ~10s dev (Metro bundle download)
```

---

## 7. Önemli Dosya Referansları

| Konu | Dosya |
|---|---|
| Fleet mimari | `docs/fleet/ARCHITECTURE.md` |
| CI/CD setup | `docs/fleet/CI_CD_SETUP.md` |
| Release checklist | `docs/fleet/RELEASE_CHECKLIST.md` |
| Chatbot tasarım | `docs/plans/2026-05-17-fleet-chatbot-design.md` |
| Chatbot bilgi tabanı | `docs/help/*.md` |
| Ride mimari | `docs/ride/plans/2026-05-15-drivermeshride-architecture.md` |
| Ride availability | `docs/ride/plans/2026-05-16-ride-availability-rules.md` |
| Test plan | `docs/plans/2026-05-16-integration-test-plan.md` |
| Demo store | `fleet/src/demo/store.ts` |
| Edge function (deployed) | `supabase/functions/chat-bot/` |
| Auth provider | `fleet/src/auth/AuthProvider.tsx` |
| Vehicle claim lib | `fleet/src/lib/vehicleClaim.ts` |
| Ride history lib | `fleet/src/lib/rideHistory.ts` |

---

## 8. Cihaz Durumu

- **Telefon:** Xiaomi POCO C40 (`adb -s 8439255f`), Android 11
- **Mevcut kurulu:**
  - `com.drivermesh.android` (fleet) — debug APK (Metro 8081'e bağlı)
  - `com.drivermesh.ride` (ride) — release APK
- **Android SDK:** `C:\Users\oguzh\AppData\Local\Android\Sdk` (local.properties)
- **JDK:** Adoptium 21

---

## 9. Expo Projeleri

| Proje | Slug | URL |
|---|---|---|
| Fleet | `drivermesh` | https://expo.dev/accounts/cray61/projects/drivermesh |
| Ride | `drivermeshride` | https://expo.dev/accounts/cray61/projects/drivermeshride |

Project IDs:
- Fleet: `8aa98c27-8538-4202-9586-337e148e9abc`
- Ride: `fc9fa0cc-cdab-4e23-abe6-521d8c644216`

---

## 10. Yeni Session Açılışı — İlk 5 Komut

Yeni Claude Code session'ı açtığında:

```bash
# 1. Konum doğrula
cd C:/Projeler/drivermesh && pwd

# 2. Son commit'leri özetle
git log --oneline -15

# 3. Bu rehberi oku
cat docs/plans/2026-05-18-continuation-guide.md | head -80

# 4. Cihaz bağlı mı?
adb devices

# 5. Memory dosyalarını oku
cat C:/Users/oguzh/.claude/projects/C--Projeler-drivermesh/memory/MEMORY.md
```

Sonra hangi alandan başlayacağına karar ver:
- **Production yayın?** → Bu rehberin §2 "Production Yayın" listesi
- **V0.2 feature?** → §3 V0.2 Backlog
- **Bug fix?** → §4 Teknik Borçlar

---

## Notlar

- **Memory:** `memory/MEMORY.md` index'inde bu rehbere pointer var (`project_continuation_2026_05_18.md`)
- **Bu rehber commit:** Bu dosya commit'lendiğinde repo'da kalıcı, sonraki session okuyabilir
- **Güncel tutma:** Yeni büyük commit yapıldıkça bu rehberi de güncelle (yoksa stale olur)

---

**Bir önceki session özeti:** ~40 commit, chatbot V0.1 + demo seed v7 + audit pass + V2 audit kalemleri (types regen + driver-only status + Üzerine Al CTA + ride history). Master HEAD `091451a`.
