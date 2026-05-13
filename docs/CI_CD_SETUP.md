# DriverMesh CI/CD Setup Guide

> GitHub Actions + EAS Build + EAS Submit ile Android otomatik build/release pipeline'i. Master push -> Internal Testing AAB; git tag -> Internal Testing'e otomatik gönderim. **Production rollout her zaman MANUEL** (Google policy + safety).

---

## Mimari

```
master push                               git tag v1.x.x
     │                                          │
     ▼                                          ▼
build-android.yml                       release-android.yml
     │                                          │
     ▼                                          ▼
EAS Build (preview)                     EAS Build (production, autoIncrement)
     │                                          │
     ▼                                          ▼
APK (sideloadable) → Expo dashboard     AAB → EAS Submit → Play Console Internal Testing (draft)
                                                              │
                                                              ▼
                                                    SEN Play Console'da
                                                    "Submit for review" basarsin
                                                              │
                                                              ▼
                                                    Closed Beta → Production
```

---

## Bir kerelik kurulum (sen yapacaksın)

### 1. EAS hesabı + project link

```bash
npm install -g eas-cli
eas login                    # expo.dev hesabin ile
eas init                     # project ID atar (app.json `extra.eas.projectId`)
eas whoami                   # dogrulama
```

### 2. GitHub Secrets ekle

Repo → Settings → Secrets and variables → Actions → **New repository secret**:

| Secret | Değer | Nereden |
|---|---|---|
| `EXPO_EAS_TOKEN` | `eas` API token (CLI standart adı `EXPO_TOKEN` ama secret adımız `EXPO_EAS_TOKEN` — workflow'da alias) | https://expo.dev/settings/access-tokens → Create Token |
| `SENTRY_AUTH_TOKEN` | `.env`'deki ile aynı | (zaten var) |
| `EXPO_PUBLIC_SUPABASE_URL` | `.env`'den | (zaten var) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `.env`'den | (zaten var) |
| `EXPO_PUBLIC_SENTRY_DSN` | `.env`'den | (zaten var) |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID` | `.env`'den | (zaten var) |
| `EXPO_PUBLIC_TELEGRAM_SUPPORT_USERNAME` | `.env`'den | (zaten var, public) |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | base64 encoded JSON | aşağıda |
| `TELEGRAM_BOT_TOKEN` (opsiyonel) | bildirim için | `web/.dev.vars`'taki value veya yeni bot |
| `TELEGRAM_CHAT_ID` (opsiyonel) | bildirim için | aynı |

### 3. Google Play Service Account JSON

Play Console'da app oluşturduktan sonra:

1. **Play Console → Setup → API access**
2. **Link Google Cloud project** (yeni veya mevcut)
3. **Create new service account** → name: `drivermesh-cicd`
4. Permissions: **"Release manager"** (Internal/Closed/Production tracks)
5. Service account → **Manage Keys** → JSON key indir
6. **Lokalde base64 encode**:
   ```bash
   # PowerShell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\key.json")) | Set-Clipboard

   # Mac/Linux
   base64 -i key.json | pbcopy
   ```
7. GitHub Secrets'ta `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` adıyla yapıştır
8. Service account'a Play Console'da app permission ver: app sayfası → Settings → API access → service account satırı → "Grant access" → DriverMesh seç → Release manager

### 4. eas.json'da iOS placeholder'ları doldur (iOS açılınca)

```jsonc
"submit.production.ios": {
  "appleId": "your-apple-id@example.com",
  "ascAppId": "1234567890",        // App Store Connect → App → URL'den
  "appleTeamId": "ABCDE12345"       // Apple Developer → Membership
}
```

Şu an iOS deferred (Android-only track), boşta kalsın.

---

## Günlük kullanım

### Master'a push (otomatik APK build)

```bash
git push origin master
```

→ `build-android.yml` tetiklenir
→ EAS Build cloud'da APK üretir (~10-15 dk)
→ Expo dashboard'tan APK indir + Sideloadly ile sideload
→ Sentry source map otomatik upload

### Production release (versiyon bump)

```bash
# 1. app.json + android/app/build.gradle versionName güncelle
# 2. CHANGELOG.md güncelle (varsa)
# 3. Tag at + push
git tag v1.0.1
git push --tags
```

→ `release-android.yml` tetiklenir
→ EAS production build (autoIncrement versionCode)
→ EAS Submit → Play Store Internal Testing track (draft, kullanıcılara gitmez)
→ Telegram bildirim
→ **SEN Play Console'a girip:**
  1. Internal testing → "Promote release" → Closed Beta
  2. ~14 gün test
  3. Closed Beta → "Promote release" → Production
  4. Rollout %20 → %100 staged

### Hot fix (kritik bug)

```bash
git checkout -b hotfix/v1.0.2
# fix
git commit
git push origin hotfix/v1.0.2
# PR mergele master'a
git tag v1.0.2 && git push --tags
```

### EAS Update (OTA, JS-only fix)

```bash
# Native değişiklik YOK, sadece JS bundle:
eas update --branch production --message "Sentry breadcrumbs fix"
```

→ Kullanıcı app'i tekrar açtığında otomatik bundle download (Apple/Google policy izinli, sadece JS değişiklikler)
→ Crash fix, copy update, küçük UI patch için kullan
→ Native module ekleme/silme = EAS Update YETERSİZ, full Play Store release gerek

---

## Force update senaryosu

Production'da kritik bir bug yakalandı (örn. ödeme akışı kırık, sigorta uyumsuzluğu):

1. **Hotfix release** (yukarıda) → v1.0.2 Play Store'da
2. **Backend'de force update tetikle**:
   ```sql
   UPDATE public.app_versions
   SET min_supported_version = '1.0.2',
       latest_version = '1.0.2',
       force_update_message_tr = 'Onemli guvenlik guncellemesi gerekiyor.',
       force_update_message_en = 'Critical security update required.',
       updated_at = now()
   WHERE platform = 'android';
   ```
3. Sonraki app foreground transition'da v1.0.1 ve eski kullanıcılar **hard modal görür** (kapatılamaz, sadece store linkı)
4. v1.0.2'ye update sonra çalışmaya devam

**Dikkat**: Her release'de force update YAPMA — Apple/Google policy "user-hostile" diye reject eder. Sadece **gerçekten kritik** durumlarda.

---

## Sentry release tracking

Her EAS Build'te source map otomatik upload edilir (`sentry.gradle` zincirinde, GitHub Actions env vars'tan):

- Sentry → Releases → `com.drivermesh.android@<versionName>+<versionCode>`
- Crash event'leri o release altında gruplanır
- Version'lar arası comparison: regression detection

---

## Troubleshooting

### `EAS build failed: Authentication required`
- `EXPO_EAS_TOKEN` secret'ı yanlış veya expired. expo.dev → Settings → Access Tokens → Regenerate
- Workflow'da `token: ${{ secrets.EXPO_EAS_TOKEN }}` ve `env.EXPO_TOKEN: ${{ secrets.EXPO_EAS_TOKEN }}` mapping doğru mu kontrol et

### Lokal `eas` CLI çalıştırırken
EAS CLI sabit `EXPO_TOKEN` bekliyor. `.env`'de `EXPO_EAS_TOKEN` adıyla yazılı; lokalde:
```bash
# PowerShell
$env:EXPO_TOKEN = (Get-Content .env | Select-String "^EXPO_EAS_TOKEN=").Line.Split('=',2)[1]
eas whoami

# Bash
export EXPO_TOKEN=$(grep '^EXPO_EAS_TOKEN=' .env | cut -d= -f2-)
eas whoami
```

### `Submit failed: Invalid service account`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` base64 değil ham JSON yapıştırılmış olabilir
- Service account Play Console'da app permission almamış olabilir
- Play Console → Setup → Internal testing → "Available to" → service account email'i ekle

### Internal Testing'de görünmüyor
- Play Console → Internal testing → Testers → kendi email'in eklenmiş mi?
- "Copy link" → tester listene gönder, link'ten install
- 1. submission ~15 dk Google review (otomatik)

### `INSTALL_FAILED_UPDATE_INCOMPATIBLE`
- Önceki release debug.keystore ile imzalı, yeni release prod keystore ile
- `adb uninstall com.drivermesh.android` + tekrar install
- Internal Testing kullanıcılar için: "Updates available" otomatik handle eder

---

## Güvenli olmayan şeyler — YAPMA

- ❌ Production track'e otomatik promote (auto-rollout) — bug Play Store'a gider
- ❌ Force update her release — store reject eder
- ❌ EAS Update ile native değişiklik gönderme — Apple kuralı, app reddedilir
- ❌ Service account JSON'u repo'ya commit (gitignored, base64'lü secret olarak GitHub'a koy)
- ❌ release.keystore'u backup'sız tut — kayıp = listing kaybı, geri dönüş yok

---

> **Son güncelleme:** 2026-05-13. EAS hesabı ve Play Console service account kurulduktan sonra ilk push'tan itibaren tam otomatik.
