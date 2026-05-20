# DriverMesh — Proje Sağlık Raporu

> **Yapı:** workspace altında iki bağımsız Expo uygulaması (`fleet/`, `ride/`), bir Cloudflare landing (`web/`), bir Supabase backend (100 migration, 13 edge function).
> **Son güncelleme:** 2026-05-20 — production launch öncesi 2 dalga: (i) infra/test health audit (A-G), (ii) launch-prep DB & config sıkılaştırma (A-D).
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

## Çözülen (2026-05-20 launch-prep dalgası A-D)

### Launch-A. Config + DML ✅
- ✅ `fleet/eas.json` + `ride/eas.json` production env'den `SENTRY_DISABLE_AUTO_UPLOAD=true` kaldırıldı → Sentry source map upload aktif, crash'ler symbolicate edilir.
- ✅ `fleet/.env.example` tam revize: eski Telegram pattern çıkarıldı (artık edge function secret), Sentry DSN/token, APP_ENV, iOS Maps key vs. eklendi.
- ✅ `app_versions` tablosu git tag'lere senkron: fleet 1.0.0 → 1.0.2, ride 0.1.0 → 0.1.3, `min_supported_version` = `latest_version` (ilk launch, schema cohesive).
- ✅ iOS `app_versions` row'ları silindi (Android-only launch; iOS pipeline Apple Developer üyeliği sonrası tekrar INSERT edilecek).

### Launch-B. RLS auth_rls_initplan optimization ✅
- ✅ 72 RLS policy `auth.uid()`/`auth.role()` → `(SELECT auth.X())` wrap edildi. PostgreSQL initplan optimization devreye girer → fonksiyon tüm satır seti için tek call.
- ✅ Etki: jobs (6), ride_requests (5), notifications (4), chat_messages (4), customers (3), 30+ tablo. 100 satırlık `jobs` listesi öncesi 100× call → şimdi 1× call.
- ✅ Tooling: [scripts/build_rls_initplan_migration.py](../scripts/build_rls_initplan_migration.py) — pg_policies'den çek, regex fix, DROP+CREATE migration üret. Tekrarlanabilir.
- ✅ Migration: [supabase/migrations/20260520163424_rls_auth_uid_initplan_optimization.sql](../supabase/migrations/20260520163424_rls_auth_uid_initplan_optimization.sql)
- ✅ Advisor `auth_rls_initplan`: **72 → 0**

### Launch-C. FK covering indexes ✅
- ✅ 42 FK kolonu için `CREATE INDEX IF NOT EXISTS` (filoLocal 22 + public 20). JOIN + cascade DELETE artık sequential scan değil.
- ✅ Tooling: [scripts/build_fk_index_migration.py](../scripts/build_fk_index_migration.py) — advisor JSON dump'ından FK adlarını parse eder, sadece flag'lenenlere indeks açar. Tüm 105 FK'ye açmak gereksiz storage + write overhead.
- ✅ Migration: [supabase/migrations/20260520164321_fk_covering_indexes.sql](../supabase/migrations/20260520164321_fk_covering_indexes.sql)
- ✅ Advisor `unindexed_foreign_keys`: **42 → 0**

### Launch-D. Security hardening ✅
- ✅ `function_search_path_mutable`: `kb_chunks_set_updated_at` + `prevent_vehicle_reassign_during_active_ride` → `ALTER FUNCTION ... SET search_path = public, pg_catalog`. Advisor: **2 → 0**.
- ✅ `anon_security_definer_function_executable`: 11 RPC anon EXECUTE kapatıldı. İlk migration `FROM anon` yetersizdi (grant PUBLIC inheritance), ikinci migration `FROM PUBLIC` ile gerçek kapatma. Advisor: **20 → 9** (kalan 9 anon-OK: trigger fonksiyonları, sign-up pre-auth, PostGIS internal, invitation lookup).
- ✅ Migration'lar: [supabase/migrations/20260520164900_security_hardening_anon_revoke_search_path.sql](../supabase/migrations/20260520164900_security_hardening_anon_revoke_search_path.sql), [supabase/migrations/20260520165200_security_revoke_public_execute.sql](../supabase/migrations/20260520165200_security_revoke_public_execute.sql)
- ✅ Advisor toplam security: **97 → 84**

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
- Sentry source map upload doğrulama (release sonrası — yeni eas.json fix sonrası ilk release tag'inde test edilecek).
- WCAG kontrast audit (V0.3+).

### Üretim sonrasına bırakılan advisor kalemleri (kabul edilebilir) ⏳

| Lint | Sayı | Karar |
|---|---|---|
| `authenticated_security_definer_function_executable` | 71 | Supabase'in standart RPC pattern'i — kasıtlı, advisor false-positive. Kapatma planı yok. |
| `multiple_permissive_policies` | 20 | 12 RLS policy konsolidasyonu manuel review gerektirir; üretim öncesi prematür. V0.4. |
| `extension_in_public` | 2 (`postgis`, `vector`) | Dedicated schema'ya taşıma RPC'leri ve `kb_chunks`'ı etkiler. V0.4 schema move planı. |
| `rls_disabled_in_public` `spatial_ref_sys` | 1 | PostGIS extension'ın sistem tablosu, postgres role owner değil → `ALTER TABLE permission denied`. Supabase bilinen istisna. |
| `auth_leaked_password_protection` | 1 | Dashboard → Auth → Settings → HaveIBeenPwned check aç (manuel). |
| `unused_index` | 94 | Yeni FK indeksleri henüz kullanılmamış sayılır; üretim trafiği başlayınca azalır. Erken silmek riskli. V0.4 audit. |
| Anon-executable kalan 9 RPC | 9 | `is_fleet_open`, `redeem_invitation_lookup`, `preview_invitation`, sign-up trigger'ları, PostGIS `st_estimatedextent` — hepsi anon erişim gerektirir. |

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
