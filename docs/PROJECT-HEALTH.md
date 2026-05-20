# DriverMesh — Proje Sağlık Raporu

> **Yapı:** workspace altında iki bağımsız Expo uygulaması (`fleet/`, `ride/`), bir Cloudflare landing (`web/`), bir Supabase backend (97 migration, 1 edge function: `chat-bot`).
> **Son güncelleme:** 2026-05-20 — health audit sonrası temizlik dalgası (#A-G).
> Bu dosya **gözden geçirilmemiş**, **eksik** veya **ileride sorun çıkarabilecek** alanları takip eder. Çözülenler "DONE" işaretiyle ✅, açık kalanlar ⏳ ile.

---

## Çözülen (2026-05-20 health audit)

### A. Repo hijyeni ✅
- ✅ Orphan dosya silindi: `C:Projelerdrivermesh.tmp_login_check.png` (Windows path bash bug).
- ✅ `fleet/.env.bak.20260513` (eski env yedek) silindi.
- ✅ `.gitignore` güncellendi: `web/.wrangler/`, `*.env.bak.*`, `C:Projelerdrivermesh*` artık tracked'a kaçamaz.

### B. CI/CD altyapı ✅
- ✅ [.github/workflows/ci.yml](../.github/workflows/ci.yml) eklendi. PR + master push → fleet + ride paralel: `npm ci` + `typecheck` + `lint` + `test`.
- ✅ ESLint v8 + `eslint-config-expo` kuruldu. Mevcut config: `fleet/.eslintrc.js`, `ride/.eslintrc.js`. **Şu an warn-only** (`array-type`, `import/order`, `no-unused-vars`); sıkı moda geçmek isteyen `--max-warnings=0` ekleyebilir.
- ✅ Jest + `jest-expo` preset kuruldu. Config: `fleet/jest.config.js`, `ride/jest.config.js`. AsyncStorage + Sentry + Supabase stub jest.setup.js'lerde.
- ✅ Örnek testler:
  - [fleet/src/lib/\_\_tests\_\_/offlineQueue.test.ts](../fleet/src/lib/__tests__/offlineQueue.test.ts) — 6 case (enqueue, flush success/fail, retry/drop).
  - [ride/src/utils/\_\_tests\_\_/forceUpdate.test.ts](../ride/src/utils/__tests__/forceUpdate.test.ts) — 5 case (semverLt).

### C. Build reproducibility ✅
- ✅ `fleet/package.json` `eas-build-pre-install` artık `npm ci` (önceden `rm -f package-lock.json && npm install`). Her EAS build aynı patch sürümlerini çeker.
- ✅ Aynı script `ride/package.json`'a da eklendi.

### D. Ride production hazırlık (kısmi) ✅
- ✅ `ride/package.json:13` → `prebuild:android` script'i fleet ile aynı pattern'de (prebuild + splash inject). Geliştirici artık manuel `node scripts/inject-fullscreen-splash.js` çağırmayı unutamaz.
- ✅ Dev bypass kill-switch: [ride/src/lib/devBypass.ts](../ride/src/lib/devBypass.ts). `__DEV__` + `EXPO_PUBLIC_DEV_BYPASS` çift gate. Production build'de zaten devre dışı; dev makinede "prod gibi davran" için env=off ile kapatılabilir.

### E. Stale artifact ✅
- ✅ `fleet/.env.bak.20260513` silindi (A grubunda da geçti).

### G. Schema operasyon ✅
- ✅ `scripts/register_migration.py` `--sync` modu eklendi. `python scripts/register_migration.py --sync` tüm `supabase/migrations/*.sql`'leri tarar, `schema_migrations`'da olmayanı toplu register eder. Idempotent. Dry-run desteği var.

---

## Açık iş kalemleri

### D-7. Google Cloud Maps billing ⏳
- **Durum:** Maps SDK "Authorization failure" hatası hem fleet hem ride APK'larında.
- **Etki:** Production map ekranı çalışmaz.
- **Aksiyon:** Kullanıcı tarafında — Google Cloud Console → Billing → Maps API'ye fatura hesabı ekle. Cloud Console'da package + SHA1 restriction'lar zaten doğru.

### D-9. Dev bypass kaldırma kararı ⏳ (V1 release prep)
- **Durum:** [ride/src/auth/AuthProvider.tsx](../ride/src/auth/AuthProvider.tsx), [ride/app/(auth)/phone.tsx](../ride/app/(auth)/phone.tsx), [ride/src/hooks/useGeolocation.ts](../ride/src/hooks/useGeolocation.ts) hâlâ dev bypass içerir.
- **Şimdi:** Çift gate (`__DEV__` + `EXPO_PUBLIC_DEV_BYPASS`) ile release APK'da otomatik kapalı.
- **V1 release öncesi karar:** kod tamamen silinsin mi, yoksa internal QA build'leri için kalsın mı? Twilio SMS aktive olunca devSignIn artık gerekmez.

### E-10. `kb-ingest` edge function temizliği ⏳
- **Durum:** Local repo'da yok (sadece `supabase/functions/chat-bot/`). Supabase Dashboard'da hâlâ deployed olabilir.
- **Aksiyon:** Kullanıcı tarafında — Dashboard → Functions → `kb-ingest` → Delete. MCP'de delete tool yok.

### F. Ride V2 yapılacaklar (yeni değil, plan)
- "Üzerine Al" RPC (`claim_vehicle_for_ride`) var, **ride'da UI yok** — sadece fleet'te kullanılıyor.
- `listMyRides()` lib var ([ride/src/lib/db/rides.ts](../ride/src/lib/db/rides.ts)), **history ekranı yok**.
- Driver ETA live update — V2 plan, polling V1'de.
- Cancel grace period UI — fleet'te eklendi, ride'da V2.
- BottomNav Expo Router Tabs migration (Option B — chip task).
- iOS pipeline — Apple Developer üyeliği sonrası.

### Play Console ⏳
- Data Safety formu doldurulmadı.
- Screenshots, app description, age rating eksik.
- Sentry source map upload doğrulama (release sonrası).
- WCAG kontrast audit (V0.3+).

---

## Tooling versiyon kilidi (referans)

| Tool | Version | Notu |
|---|---|---|
| Expo SDK | 54 | RN 0.81, new architecture açık |
| TypeScript | ~5.9.2 | strict mod |
| ESLint | ^8.57.0 | v9+ flat config gerektirir; eslint-config-expo 55 v8'e bağlı |
| eslint-config-expo | ^55.0.1 | Expo'nun resmi preset'i |
| Jest | ^29.7.0 | jest-expo 55 v29'la uyumlu |
| jest-expo | ^55.0.18 | preset, RN transform pattern'i içerir |
| @types/jest | ^30.0.0 | type'lar v29 ile uyumlu (geri uyumlu) |
| react-test-renderer | ^19.1.0 | React 19.1.0'a kilit |

---

## Bilinen kalıcı riskler

- **Lock dosyaları workspace değil app-içi.** fleet ve ride ayrı `package-lock.json` tutar. Cross-app değişikliklerde ikisini de bump etmek gerekebilir.
- **`react-native-web` peer conflict.** EAS pre-install `--legacy-peer-deps` ile geçiyor; sıkı `npm ci` `react-dom` peer'ında patlayabilir → her zaman `--legacy-peer-deps`.
- **Schema migration register manuel.** DDL'i kullanıcı dashboard'dan apply ettikten sonra `python scripts/register_migration.py --sync` çalıştırmazsa Supabase CLI lokal diff bozulur.
- **Supabase prompt dil/locale.** Edge function `chat-bot` Türkçe; user dili değişirse prompt template güncellenmedi (V2).
