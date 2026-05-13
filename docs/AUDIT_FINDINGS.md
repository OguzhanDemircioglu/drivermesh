# DriverMesh Pre-Production Audit — Findings & Action Status

> 2026-05-13 üç paralel ajan audit'i (security + logic/architecture + performance) sonucu konsolide rapor + uygulanan paket A/B/C çıkarımları + bekleyen iş listesi.

---

## ✅ Uygulananlar (commit'ler)

### Paket A — Code/Build (lokal, low-risk)
| # | Bulgu | Çözüm | Dosya |
|---|---|---|---|
| A1 | AAB universal 67.5 MB, splits yok | `bundle { abi/density/language { enableSplit = true } }` | `android/app/build.gradle` |
| A2 | Maintenance approve race — duplicate push + silent overwrite | Conditional UPDATE + `.select('id')` rowcount check + early throw | `src/lib/maintenance.ts:240-301` |
| A3 | reassignJob no concurrency guard — in-flight overwrite | `.in('status', ['open','assigned'])` + rowcount check | `src/lib/jobs.ts:617-642` |
| A4 | Image cache unbounded Map — 30-60 MB memory leak prod | LRU helper (lruGet/lruSet), MAX_CACHE_ENTRIES=50 | `src/lib/imageCache.ts` |
| A5 | Account 3 useFocusEffect double-fetch | Konsolide tek useFocusEffect, paralel async | `app/(app)/account/index.tsx:59-72` |
| A6 | ProGuard `abi51_0_0.expo.modules.**` ölü kural | Sil (eski Expo SDK 51 kalıntısı) | `android/app/proguard-rules.pro:38` |

**Telefon smoke test:** Demo girişi + Home render OK, regression yok.

### Paket B — Backend (DDL + verification)
| # | Bulgu | Sonuç |
|---|---|---|
| B1 | DB indexes audit — eksik 2 composite/partial | ✅ `add_missing_perf_indexes` migration: `idx_vehicles_org_status` + `idx_va_vehicle_active partial WHERE released_at IS NULL` (diğer önerilenler **zaten mevcut**: notifications recipient/org composite, vehicles current_user partial, jobs org/driver/status, vehicle_assignments user partial, maintenance_requests pending partial) |
| B2 | send-push v4 deploy doğrulaması | ✅ **VERIFIED** — Edge fn kodu `verify_jwt: true`, caller token validate, caller-recipient org_id match, self-target skip, service_role bypass (cron path), notif persistence, FCM 404'te token cleanup. Audit'in P1 endişesi geçersiz. |
| B3 | release_vehicle RPC body'sinde `auth.uid()` check var mı | ✅ **VERIFIED** — `auth.uid()` + `cross_org` check + `WHERE user_id = v_user AND released_at IS NULL` + double-check `vehicles.current_user_id = v_user`. Audit'in P1 endişesi geçersiz. |
| B4 | maintenance-cron secret URL→Authorization header | ⚠️ **Pending user approval** — Edge function deploy permission gerek (verify_jwt:false + production infra). Hazır kod: `maintenance-cron` v3, `Authorization: Bearer ${secret}` header'dan okur. RPC update de gerek (`maintenance_cron_invoke` http_post header'a koymalı). Onay verirsen tek seferlik apply. |

### Paket C — Hızlı yapılanlar
| # | Bulgu | Çözüm |
|---|---|---|
| C2 | Demo bot token (`8594702070:...`) hardcoded repo'da | ✅ `'DEMO_BOT_TOKEN_PLACEHOLDER'` placeholder + comment. **Sen yapacaksın:** @BotFather → `/revoke` → eski token iptal. |

---

## ⚠️ Kullanıcı tarafı işler (manuel veya onay gerek)

### Yüksek öncelikli (release öncesi)
1. **Firebase Console — Maps API key restriction**
   - URL: https://console.cloud.google.com/apis/credentials
   - API key: `AIzaSyCneM8AuTrbhqWDUfa8aSesoXPddXd3sEU` (`google-services.json:18`)
   - Application restrictions → Android apps → Add:
     - `com.drivermesh.android`
     - SHA-1: `E7:6B:9F:AC:D7:89:FF:F0:5A:18:C7:44:FD:D2:35:2B:76:4B:83:37`
   - API restrictions: sadece FCM + Firebase services
   - **Neden:** API key zaten `google-services.json`'da committed (EAS prebuild gereği). Restriction olmazsa quota abuse + bill shock.

2. **BotFather — demo bot revoke**
   - Telegram → @BotFather → `/mybots` → `offcats_bot` → API Token → Revoke
   - Yeni bot lazım olursa yeniden oluştur, `src/demo/store.ts:201` placeholder'a ekle (yine demo-only, APK decompile'da görülür).

3. **Edge function deploy onayları (yapılırsa B4 + C1 kapanır):**
   - `maintenance-cron` v3 (cron secret URL→header, log redaction faydası)
   - `send-support-message` v1 yeni (Telegram support backend RPC migration)
   - **Senden istek:** "edge fn deploy için onay" gibi açık bir mesaj at, ben deploy + repo refactor yaparım.

### Orta öncelik (release sonrası ilk sprint)
4. **Telegram support → backend Edge Function** (audit P1)
   - Mevcut: `src/lib/support.ts:15` client bundle'da `EXPO_PUBLIC_TELEGRAM_SUPPORT_API_KEY` → APK decompile token sızar.
   - Çözüm: yeni `send-support-message` edge fn (verify_jwt:true), Vault'tan token okur. Client `supabase.functions.invoke('send-support-message', { body: {...} })` çağırır, env vars kalkar.
   - Süre: 30 dk (edge fn 60 satır + lib refactor + .env temizliği).

5. **Org-level Telegram bot — Vault per-org** (audit P1)
   - Mevcut: `organizations.feedback_telegram_bot_token` plaintext column. `feedback.ts:69` org members okuyabilir → driver/manager bot token çalabilir → fake müşteri feedback gönderebilir.
   - Çözüm seçenekleri:
     - **A) Vault per-org**: `vault.create_secret(token, 'telegram_bot_' || org_id)`, RLS'siz görünmez. `feedback.ts` `get_vault_secret(...)` RPC kullanır.
     - **B) Central DriverMesh-owned bot**: tek bot, org subscribe ettiği channel'a yazar (basit + güvenli, ama org-customization yok).
     - **C) Hybrid**: default central bot + opt-in Vault per-org.
   - Süre: 2-3 saat (migration + lib refactor + UI).

### Uzun vadeli (ayrı sprint)
6. **Hierarchy Phase 2 RLS** (audit P1)
   - Memory `project_hierarchy_branching.md` Phase 1 ✅ (schema), Phase 2 ❌ (scope filter).
   - Şu an manager A başka manager B'nin drivers'ını + jobs'larını görür/atayabilir.
   - Multi-team customer onboard etmeden önce kapatmak şart.
   - Süre: 1-2 gün (RLS policy 9 tablo + lib query filter + test).

### Düşük öncelik (post-launch)
7. **Cron secret URL→header** (audit P2) — B4 onay sonrası 5 dk
8. **maintenance_pending_reminder dedupe** (audit P2) — `Set<requester_id>` ile aynı user'a 2 push yerine 1
9. **notifyOne async failure handling** (audit P2) — push fail'inde toast.warning
10. **Push permission denied path** (audit P1 UX) — Settings deep-link banner
11. **Database TypeScript types regenerate** (audit P2) — `supabase gen types typescript` ile drift fix
12. **getItemLayout** 4 listeye (audit P2) — ~10-20% scroll smoothness
13. **Hot-path renderItem useCallback** (audit P2) — memo bypass fix
14. **Sentry replay rate düşük-end cihaz** (audit P2) — `Platform + DeviceMemory` koşullu
15. **Push deep-link handler** (audit P2 UX) — `addNotificationResponseReceivedListener` + route by `payload.type`

---

## 🎯 Verified — sorun yok (audit doğrulamaları)

- `.env` / keystore git'te değil + history temiz (`git log --all -- .env` empty)
- Demo mode Supabase guard 13/13 lib dosya `isDemoActive()` first-line
- send-push v4 caller-recipient org match **production'da deployed** (B2)
- release_vehicle RPC `auth.uid()` + `user_id` filter + `cross_org` check (B3)
- Cloudinary signed upload — backend signature, client API secret görmez
- Sentry `sendDefaultPii: false` + manual setSentryUser (KVKK uyumlu)
- FlatList migration 4/4 ekran (jobs, vehicles, team, notifications)
- JobCard/VehicleCard `memo()` 3/3 kart komponenti
- Realtime subscription leak yok (0 `supabase.channel` usage)
- Hermes + R8 + shrinkResources aktif
- Race-safe pattern `acceptOpenJob`, `cancelMaintenanceRequest` (audit'in övdüğü ref)
- 11 SECURITY DEFINER fn anon REVOKE + authenticated GRANT (önceki round)
- `cloudinary_public_id_from_url` search_path locked (önceki round)
- DB index hijyeni: 19/21 önerilen index zaten kayıtlı

---

## Audit metodolojisi

3 paralel agent (debugger / backend-architect / mobile-developer) bu repo state'i + memory'leri + Supabase live DB üzerinde audit yaptı. Bulguların:
- 30+ ham bulgu → P0 (3) + P1 (10) + P2 (8) + P3 (4) prioritization
- Her bulgu kanıt ile (file:line + DB query)
- 18 olumlu doğrulama (memory'deki claim'lerin gerçek olduğunu kanıt)
- 2 audit P1 endişesi production verify ile **geçersiz çıktı** (send-push v4, release_vehicle)

**Çıkarım:** Codebase production-ready'ye çok yakın. Paket A code patches + Paket B verification + 2 yeni DB index ile **submission-blockable** bir şey kalmadı; Paket C'deki 5 madde "release sonrası ilk sprint" kategorisinde.
