# DriverMesh — Geliştirici Onboarding

> Workspace'i yeni klonlayan biri 30 dakika içinde lokal ortamı çalışır hale getirebilir. Yapı: iki bağımsız Expo uygulaması (`fleet/`, `ride/`), bir Cloudflare landing (`web/`), Supabase backend (`supabase/`).

---

## 1. Ön Gereksinimler

- **Node.js** 20.x (CI matrix bu sürümde test eder)
- **npm** (yarn/pnpm değil — lock dosyaları npm)
- **Android SDK** lokasyonu: `C:/android-sdk` (Windows). Build sırasında inline geç:
  ```
  ANDROID_HOME=/c/android-sdk PATH=/c/android-sdk/platform-tools:$PATH
  ```
- **adb** — `where adb` ile lokasyon doğrula
- **Python 3.10+** (sadece `scripts/*.py` için, opsiyonel)
- **Supabase CLI** (opsiyonel, migration sync için)
- **EAS CLI** (release build için): `npm install -g eas-cli`

---

## 2. İlk Kurulum

```bash
# 1) Bağımlılıklar (her iki app ayrı)
cd fleet && npm install --legacy-peer-deps && cd ..
cd ride && npm install --legacy-peer-deps && cd ..

# 2) Env dosyaları
cp fleet/.env.example fleet/.env       # değerleri Supabase Dashboard'dan al
cp ride/.env.example ride/.env

# 3) Database types (her iki app ayrı senkronize edilir)
cd fleet && npm run gen:types && cd ..
cd ride && npm run gen:types && cd ..
```

**`--legacy-peer-deps` ŞART.** `react-native-web` `react-dom` peer'ında çakışır; bu bayrak olmadan `npm install` veya `npm ci` patlar.

---

## 3. Günlük Geliştirme

### Lint + typecheck + test (PR açmadan önce zorunlu)

```bash
cd fleet && npm run typecheck && npm run lint && npm test
cd ride && npm run typecheck && npm run lint && npm test
```

CI ([.github/workflows/ci.yml](../.github/workflows/ci.yml)) bunların hepsini her PR'da çalıştırır. Lint warn-only — error fail eder, warning sadece raporlanır.

### Lokal dev server

```bash
# fleet (driver/owner app)
cd fleet && npm start            # Metro bundler, QR kod ile cihaza bağlan
cd fleet && npm run android      # USB cihaza yükle
cd fleet && npm run web          # tarayıcıda preview (localhost:3000 + reverse proxy)

# ride (customer app)
cd ride && npm start
cd ride && npm run web
```

Web preview'da `localhost:3000`'i tercih et — diğer port'lar açma (mevcut workflow böyle yerleşik).

### Test yazma

- Pure logic + AsyncStorage'lı modüller: Jest preset `jest-expo`, AsyncStorage/Sentry/Supabase stub `jest.setup.js`'de.
- Test dosyaları: `__tests__/<module>.test.ts` veya `<module>.test.ts` yan yana.
- Örnek: [fleet/src/lib/\_\_tests\_\_/offlineQueue.test.ts](../fleet/src/lib/__tests__/offlineQueue.test.ts), [ride/src/utils/\_\_tests\_\_/forceUpdate.test.ts](../ride/src/utils/__tests__/forceUpdate.test.ts).
- RPC/Supabase'e ulaşan kodu test ederken: yardımcı fonksiyonu `export` et + ona unit test yaz; gerçek client'i test'ten çağırma.

---

## 4. Database (Supabase)

### Yeni migration yazma

```bash
# 1) Dosya yarat
touch supabase/migrations/$(date +%Y%m%d%H%M%S)_<snake_case_name>.sql

# 2) DDL'i içine yaz (CREATE / ALTER / DROP / yeni RPC vs.)

# 3) Apply — sen Dashboard SQL Editor'dan çalıştırırsın
#    (otomatik mod DDL çalıştırmaz, kullanıcı kararı)

# 4) Sicil sync
export DB_PASS=$(grep '^SUPABASE_DB_PASSWORD=' fleet/.env | cut -d= -f2-)
python scripts/register_migration.py --sync
```

`--sync` modu idempotent — her zaman güvenli, sadece `schema_migrations`'da olmayanı ekler. Dry-run: `--sync --dry-run`.

### Types yeniden üret (her DDL sonrası)

```bash
cd fleet && npm run gen:types
cd ride && npm run gen:types
git diff src/lib/database.types.ts   # incele, gerek yoksa commit
```

### Test verisi temizleme

```bash
# Kullanıcı tarafından — Dashboard SQL Editor'dan çalıştır
# (en güncel reset SQL için bkz docs/TESTING.md §0)
```

---

## 5. Release

Production rollout pipeline'ı: [docs/fleet/CI_CD_SETUP.md](fleet/CI_CD_SETUP.md).

Özet:
- `git tag fleet-v0.x.y` → fleet AAB → Play Console Internal Testing (draft)
- `git tag ride-v0.x.y` → ride AAB → Play Console Internal Testing (draft)
- Console'da "Submit for review" + Closed Beta → Production manuel

---

## 6. Yapma:

- **`rm -f package-lock.json`** — lock dosyaları reproducible build için kritik. `--legacy-peer-deps` ile çalış.
- **DDL'i otomatik çalıştır** — schema değişikliği kullanıcı kararı. Migration yaz, kullanıcıya ilet.
- **`.env` dosyalarını commit etme** — `.env.example` günceldir, gerçek değerleri Dashboard'dan al.
- **Secret'ları chat'e yapıştırma** — credential rehberi verirken sadece env var ismini söyle.
- **Production migration'a `IF NOT EXISTS` koymayı unutma** — schema sync hatası geri çevrilemez.
- **Dev bypass'lar üzerinde bina yapma** — [ride/src/lib/devBypass.ts](../ride/src/lib/devBypass.ts) release'de devre dışı. Üretim kodu bunlardan beslenmez.

---

## 7. Sorun Çözüm

| Belirti | Sebep | Çözüm |
|---|---|---|
| `Authorization failure` Maps ekranında | Google Cloud billing yok | Console → Billing → Maps API'ye fatura |
| `supabaseUrl is required.` test'te | jest.setup.js'de env stub eksik | `fleet/jest.setup.js` veya `ride/jest.setup.js` çek, EXPO_PUBLIC_SUPABASE_URL stub ekle |
| ESLint flat config hatası (`couldn't find eslint.config.js`) | ESLint v9+ yüklendi | `eslint@^8.57.0` downgrade |
| Splash siyah Android 12+'da | `inject-fullscreen-splash.js` post-prebuild atlandı | `npm run prebuild:android` (script otomatik çağırır) |
| `npm ci` peer conflict | `react-native-web` `react-dom` peer | `npm ci --legacy-peer-deps` |
| Migration "missing" in Supabase CLI | schema_migrations sync yapılmadı | `python scripts/register_migration.py --sync` |

Daha fazla: [docs/PROJECT-HEALTH.md](PROJECT-HEALTH.md) (açık iş kalemleri + bilinen riskler).
