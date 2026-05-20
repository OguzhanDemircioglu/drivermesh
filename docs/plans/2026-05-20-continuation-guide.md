# DriverMesh — Devam Rehberi (2026-05-20)

> **Önceki rehber:** [2026-05-18-continuation-guide.md](2026-05-18-continuation-guide.md) — stale.
> **Master HEAD:** Bu konuşma 9 commit ile master'ı ileri taşıdı (Phase 2 RLS, baseline, i18n, cron PASS, continuation guide, cancel grace UI, bot function calling). Son tag: `v1.0.2` + `ride-v0.1.3`.

---

## 1. 2026-05-20 Session'da Bitenler

### Hierarchy Phase 2 RLS (commit `eed3674`)

Manager rolü artık sadece kendi `manager_id` altındaki şoförlerin jobs / vehicles / ride_requests / vehicle_assignments kayıtlarını görür & günceller.

- Yeni helper: `current_user_can_see_user(uuid)` (SECURITY DEFINER, STABLE)
- 7 RLS policy güncellendi (jobs SELECT+UPDATE, vehicles SELECT+UPDATE, ride_requests staff SELECT, vehicle_assignments SELECT+UPDATE)
- Owner: tüm org (değişmedi); Driver: değişmedi (defense-in-depth ayrı kalem)
- Smoke test PASS: owner 3/3 satır, manager 2/3 (D2 görmez), UPDATE D1=1 row D2=0
- Migration: `supabase/migrations/20260520120000_hierarchy_phase2_manager_scope_rls.sql`
- Detay: `docs/plans/2026-05-20-hierarchy-phase2-rls.md`

### Supabase migrations baseline (commit `9ca8dc3`)

93 production migration + Phase 2 = 94 dosya `supabase/migrations/<version>_<name>.sql` formatında repo'da. Bundan sonra Flyway pattern:

```powershell
npx supabase migration new <name>     # YYYYMMDDHHMMSS_<name>.sql üretir
# Düzenle
npx supabase db push                   # uzak prod'a uygula
# Lokal:
npx supabase start && npx supabase db reset  # baseline + tüm migration tek komut
```

- MCP `apply_migration` ve Dashboard SQL Editor doğrudan kullanılmaz (schema_migrations sync bozulur)
- Acil durumda dashboard kullanılırsa: `python scripts/register_migration.py <version> <name> <path>` ile schema_migrations'a kaydet
- Detay: `supabase/migrations/README.md` + `scripts/README.md`

### Cron auto-checkout end-to-end PASS (commit `1eee641`)

- Test vehicle `maintenance` + `maintenance_until = NOW() - 2m` → 60s içinde `status='idle'`, maintenance_* fields cleared
- Cron her dakika succeeded (`cron.job_run_details` jobid=3)
- send-push çağrısı 200 OK (manager yoksa skip, fail-silent try/catch)
- Eski `maintenance_auto_checkout()` RPC zaten DB'de yok (drop edilmiş, sadece `maintenance_cron_invoke()` kaldı)

### Fleet hardcoded TR audit (commit `375d452`)

2 user-facing string lokalize edildi:
- `driver-ride.tsx:336` rating yıldız a11y → `t('driverRide.ratingStarsLabel')`
- `ChatBotBadge.tsx:29` "Bana Sor" bubble → `t('chatbot.askMe')`

Kalan TR karakter occurrence'ları yorum / demo data / fallback messageTr (zaten i18n pattern).

---

## 2. Senin Tarafında Bekleyen

### Acil
- [ ] **Release tag push** (auto mode classifier prod deploy push'u bloke etti):
  ```powershell
  git tag v1.0.2
  git tag ride-v0.1.3
  git push origin v1.0.2 ride-v0.1.3
  ```
  → GitHub Actions otomatik EAS production build + Play Store internal track draft
- [ ] **Chatbot gerçek user testi** — Gemini 2.5'e geçildi (commit `ae81f23`), gerçek hesapla doğrulanmadı
- [ ] **Sentry source map verify** — release build sonrası dashboard'da symbolication doğrula

### Atlanan
- ~~Google Maps billing aktivasyonu~~ — kullanıcı şimdilik atlamak istedi

### Production yayın (Play Console)
- [ ] Data Safety form
- [ ] Age rating (IARC questionnaire)
- [ ] Screenshots TR + EN (telefon + tablet aspect)
- [ ] App description TR + EN (kısa + uzun)
- [ ] Telegram support bot prod token (test bot revoke edildi)
- [ ] Submission Sonrası: Internal Testing → Closed Beta (~14 gün) → Production (rollout %20 → %100)

### iOS (ertelendi)
- [ ] Apple Developer üyeliği ($99/yıl)
- [ ] APNs key + Cocoapods Sentry setup

---

## 3. V0.2 Backlog (Kod tarafı)

| Öncelik | İş | Durum |
|---|---|---|
| ~~HIGH~~ | Hierarchy Phase 2 RLS | ✅ Done (2026-05-20) |
| ~~MEDIUM~~ | Driver ETA canlı update | ✅ Done (commit `d3ffbf3`, useDriverActiveRide realtime + 30s fallback) |
| ~~MEDIUM~~ | Cancel grace period UI | ✅ Done (commit `5338b99`, 2dk grace + countdown + fee uyarı) |
| ~~MEDIUM~~ | Bot function calling | ✅ Done (3 read-only tool: get_fleet_stats, list_open_jobs, list_vehicles_in_maintenance) — edge function chat-bot v11. Test PASS 3/4 (Cloudflare fallback path için 1 hallucination, acceptable) |
| LOW | Embedding RAG (pgvector) | `chat-bot/kb.ts` keyword → embedding |
| LOW | Ride session listesi (chatbot) | Şu an tek aktif session — geçmiş sohbetler UI |
| LOW | Driver-side RLS daraltma | Defense-in-depth: `org_read_jobs/vehicles` driver'a tüm org SELECT izni veriyor (kod tarafında `listMyJobs(driverId)` filtreliyor ama RLS değil) |

---

## 4. Bilinen Teknik Borçlar (Devam Eden)

- ~~Fleet hardcoded TR audit~~ ✅ Done (2026-05-20)
- ~~Maintenance migration~~ ✅ Done (auto_checkout RPC drop, cron + edge function ACTIVE)
- **WCAG kontrast audit** — harita pill dışında başka yerler audit edilmedi
- **Sentry source map** — release sonrası dashboard symbolication doğrulama (user task)
- **Driver-side RLS daraltma** (defense-in-depth) — şu an `org_read_jobs/vehicles` driver'a tüm org SELECT izni veriyor (kod tarafında `listMyJobs(driverId)` filtreliyor ama RLS değil)
- 3 pre-existing TS hatası: `ride-history.tsx:26` (status enum 'created' yok), `GuidedTourOverlay.tsx:45` (tuple index), `demo/store.ts:906` (profile status string→enum)

---

## 5. Yeni Workflow Notları

### DDL (artık dosya tabanlı)
1. `npx supabase migration new <name>` → boş `.sql` dosyası
2. SQL'i düzenle
3. Lokal test: `npx supabase db reset`
4. Prod: `npx supabase db push`
5. Asla Dashboard SQL Editor + `apply_migration` MCP doğrudan kullanma (acil hariç → sonra `register_migration.py`)

### DB password
- `fleet/.env`, `ride/.env` → `SUPABASE_DB_PASSWORD=<prod-pw>` ekli
- Connection: `postgresql://postgres.ucitxvsndlwvvnqwabgo:<pw>@aws-1-eu-central-1.pooler.supabase.com:5432/postgres`
- `aws-1` zorunlu (bu proje için), `aws-0` "Tenant not found" verir
- Direct connection (`db.<ref>.supabase.co`) IPv6-only, lokal'de timeout

### Lokal Postgres dev
```powershell
npx supabase start    # Docker stack
npx supabase db reset # baseline + tüm migration uygulanır
psql postgresql://postgres:postgres@localhost:54322/postgres
```

---

## 6. Memory Pointer

`C:\Users\oguzh\.claude\projects\C--Projeler-drivermesh\memory\project_continuation_2026_05_18.md` — bu dosyaya pointer + güncel durum özeti. Yeni session açıldığında oradan başla.
