# Test Resume Rehberi — Tabula Rasa E2E (yeni session için)

**Hazırlandı:** 2026-05-16 ~17:00 (önceki session)
**Durum:** §4.2 Mehmet redeem'in **başındayız** — "Davet Kodum Var" tıklandı, kod input ekranı açıldı (snapshot yapılmadı, snapshot yeni session'da ilk adım).

---

## 1. Hızlı Bağlam

İki Expo projesi (`fleet/` + `ride/`) için web preview üzerinden E2E testi koşturuyoruz. DB tabula-rasa state'inde başlandı (TRUNCATE + auth.users wipe). [docs/TESTING.md](TESTING.md) v2.0 senaryo rehberi — §0–§15.

**Test aktörleri:**
- *Ayşe Demir* (Patron, fleet-web) — `ayse-test@drivermesh.local` / `Test1234!`
- *Mehmet Yıldız* (Şoför, fleet-web, Ayşe → çıkış sonrası) — `mehmet-test@drivermesh.local` / **şifre redeem akışında girilecek**
- *Selin Yıldız* (Müşteri, ride-web) — phone `+905551234567` (devSignIn fallback)

---

## 2. Server Durumu (yeni session'da değişebilir, doğrula)

| App | Port | serverId | Komut | Notlar |
|---|---|---|---|---|
| ride-web | 8082 | `ed7d0131-cd4a-4322-894d-a3bf12831263` | `mcp__Claude_Preview__preview_start name="ride-web"` | Çalışıyor olmalı, kontrol et: `preview_list` |
| fleet-web | 8083 | `39bf9bc8-78f5-4647-b91e-070ba5a32df5` | `mcp__Claude_Preview__preview_start name="fleet-web"` | react-native-maps web shim'i devrede |

**Yeni session başlangıç check:**
```
mcp__Claude_Preview__preview_list  → 2 server "running" mu?
```
Eğer kapalıysa `preview_start name="fleet-web"` ve `preview_start name="ride-web"` yeniden başlat. Bundle 13-20 sn.

---

## 3. DB Snapshot (önceki session bitiminde)

```
auth.users         : 1  (Ayşe — ayse-test@drivermesh.local)
organizations      : 1  (Demir Lojistik, id=9d30dccd-787b-4092-9296-22b904de7823)
profiles           : 1  (Ayşe Demir, id=847c95e4-7d5a-4392-a242-cfe8a2c41633, owner, status=active)
fleets_visibility  : 1  (ride_enabled=false default)
invitations        : 1  (Mehmet Yıldız, driver, status=pending, short_code='233064')
vehicles           : 0
ride_requests      : 0
ratings            : 0
```

**Yeniden başla isteğin varsa** (örn. yarım bırakılan §4.2'yi clean tetiklemek):
```sql
-- §0 reset (TESTING.md §0.1 hâli)
TRUNCATE TABLE public.ratings, public.payments, public.ride_offers, public.ride_requests,
  public.maintenance_requests, public.notifications, public.customer_notifications,
  public.permission_overrides, public.vehicle_assignments, public.invitations,
  public.jobs, public.vehicles, public.fleets_visibility, public.customers,
  public.profiles, public.organizations RESTART IDENTITY CASCADE;
TRUNCATE TABLE "filoLocal".users, "filoLocal".company_members, ... RESTART IDENTITY CASCADE;
DELETE FROM auth.users;
```
(Tam liste TESTING.md §0.1'de.)

---

## 4. Senaryo Durum Listesi

| # | Senaryo | Durum | Not |
|---|---|---|---|
| §0 | Pre-Test Reset | ✅ DONE | Iki round (sırasıyla `truncate_all_user_data_public_and_filolocal` + `truncate_for_web_e2e_run` + `truncate_test_data_for_fresh_e2e`) |
| §3 | Filo Başlatma (Ayşe) | ✅ PASS | fleet-web preview_eval+fill ile; auth.users + org + profile + fv otomatik düştü, trigger `create_fleet_owner_on_signup` çalıştı |
| §4.1 | Şoför daveti oluşturma | ✅ PASS | Davet kodu `233064`, DB invitation row pending |
| **§4.2** | **Mehmet redeem** | **🟡 IN PROGRESS** | Ayşe çıkış yaptı, Welcome'a döndü, "Davet Kodum Var" tıklandı. Snapshot yapılmadı; yeni session'da ilk iş `preview_snapshot serverId=39bf9bc8...` |
| §5 | Filo yapılandırma | ⏳ TODO | Ride_enabled aç (Hesap → Yolcu Hizmeti toggle) + 2 vehicle ekle (UI MapPicker ekranı içeriyor — web shim'in BUG yaratıp yaratmadığını kontrol et) + Mehmet aktif + Mehmet vehicle claim |
| §6 | Selin ride/web signup | ⏳ TODO | ride-web (8082) — phone signup, dev fallback. Galata mock konum, vehicle listesinde Mehmet'in claim ettiği araç görünmeli. |
| §7 | Cross-app E2E | ⏳ TODO | İki tab paralel: Selin request_ride → Mehmet driver-ride → vardım/başlat/tamamla → iki yönlü rating |
| §8 | Edge cases | ⏳ TODO | Double-tap idempotency, T6/T7/T11/T12, cancel |
| §10 | Force update | ⏳ TODO | Composite (platform, app) key isolation testi |
| FINAL | Rapor + advisor delta | ⏳ TODO | Bug listesi + Sentry/RLS sızıntı + DB advisor delta |

---

## 5. §4.2 Devam Adımları (yeni session'da ilk eylem)

1. `preview_snapshot serverId=39bf9bc8-78f5-4647-b91e-070ba5a32df5` — şu an hangi ekran?
2. "Davet kodu" input + form bekleniyor. Form alanı için **kod `233064`** gir:
   ```js
   preview_fill 'input[type="text"]' veya placeholder match → "233064"
   ```
3. Doğrulama RPC'si: `redeem_invitation_lookup('233064')` — accept edilebilir mi UI yansıttı mı?
4. Devam form: full_name + email (invitation'dan auto-fill bekleniyor) + parola → "Test1234!"
5. Submit → Mehmet için auto-signUp + redeem_invitation_complete RPC otomatik tetiklenmeli
6. DB doğrulama:
   ```sql
   SELECT id, full_name, role, status::text, organization_id FROM public.profiles WHERE full_name='Mehmet Yıldız';
   SELECT status::text, accepted_at FROM public.invitations;
   ```
   Beklenen: Mehmet profile (driver, status='off_duty', org=Demir Lojistik), invitation accepted.
7. Anasayfa açılır (driver perspective) → status pill "Mesai Dışı"

---

## 6. §5 Filo Yapılandırma Hatırlatması

**Önce Ayşe yeniden login** (Mehmet'le test bitince Ayşe → Welcome → Giriş Yap → ayse-test@drivermesh.local / Test1234!).

Adımlar:
1. Hesap → "Yolcu Hizmeti" → toggle ON
   - SQL ile service_area set (UI'da Lojistik Üssü ekranı MapPicker içeriyor, web shim "Harita web'de devre dışı" gösterir → service_area set'ini SQL ile yap):
     ```sql
     UPDATE public.fleets_visibility
        SET service_area = ST_Buffer(ST_SetSRID(ST_MakePoint(28.9742, 41.0256), 4326)::geography, 30000)::geography
      WHERE organization_id = '9d30dccd-787b-4092-9296-22b904de7823';
     ```
2. "Araç Ekle" Hızlı Aksiyon → vehicle form (PhotoPicker web'de no-op olabilir; plate/brand/model/year/color ile devam)
   - 2 araç ekle: `34 TST 001` Renault Master 2024 Beyaz + `34 TST 002` Mercedes Vito 2024 Beyaz
   - Trigger `vehicles_set_default_owner` auth.uid()=Ayşe → current_user_id=Ayşe (owner default)
3. Ayşe çıkış → Mehmet giriş (`mehmet-test@drivermesh.local` / Test1234!)
4. Mehmet anasayfa status pill → "Aktif" seç (bottom sheet)
5. Mehmet Filo tab → bir aracı "Üzerine Al" (UI'da bu buton var mı kontrol; yoksa SQL ile `claim_vehicle_for_ride` RPC çağrısı):
   ```sql
   -- RPC çağrı için Mehmet auth.uid() lazım; service-role bypass:
   SELECT public.claim_vehicle_for_ride('<vito-uuid>');
   ```
   Veya direkt UPDATE (memory'de bahsedildiği üzere):
   ```sql
   UPDATE public.vehicles SET current_user_id='<mehmet-uuid>' WHERE plate='34 TST 002';
   ```

---

## 7. Bilinen Bug'lar / Bulgular (önceki session'dan)

| # | Severity | Açıklama |
|---|---|---|
| BUG-A1 | P2 | ADB input arka arkaya tap+text, RN ScrollView klavyeyi açar/form yukarı scroll'lar → ardışık tap'ler yanlış alana düşer. **Workaround:** her tap+text sonrası `input keyevent 4` ile klavyeyi kapat. **Kalıcı çözüm:** Detox/Maestro entegrasyonu (V2). |
| BUG-UI1 | P2 | Anasayfa setup hero satırları (1.Ekip, 2.Araç) ADB tap'lerine yanıt vermiyor. **Workaround:** deep-link (`drivermesh:/team`). Web tarafında preview_eval `pointerdown/pointerup/click` ile çalışıyor. |
| BUG-UI2 | P2 | Team ekranı "Şoför Ekle" buton ADB tap'i yanıt vermiyor (Pressable handler). Aynı workaround. |
| BUG-WEB1 | P1 | **fleet web bundle crash**: `react-native-maps` web'de `codegenNativeComponent is not a function`. **Fix uygulandı:** [fleet/src/web-shims/react-native-maps.web.tsx](../fleet/src/web-shims/react-native-maps.web.tsx) + metro.config.js platform-resolver. Mobile'da değişiklik yok. |
| BUG-DB1 | — | **GERI ÇEKİLDİ.** Owner default status='active' spec'e uygun (trigger `create_fleet_owner_on_signup` source code'unda: `CASE WHEN v_role = 'owner' THEN 'active' ELSE 'off_duty' END`). |
| NOTE-1 | — | `filoLocal` schema'sı (28 tablo, 32 satır) audit-discovered, memory/docs'ta yok. TRUNCATE edildi, schema duruyor; V2'de `DROP SCHEMA "filoLocal" CASCADE` ayrı migration. |
| NOTE-2 | — | Auto-mode classifier production DB destructive migration'ı bloklamaktan dolayı bazı işlerde `apply_migration` öncesi explicit kullanıcı onayı isteyebilir; bypass mode aktivasyonu öneriliyor. |

---

## 8. Henüz Commit Edilmemiş Değişiklikler (önceki session)

20+ dosya modified, 1 yeni dosya (`fleet/src/web-shims/react-native-maps.web.tsx`):

**fleet:**
- `metro.config.js` — platform=web için react-native-maps shim resolver
- `package.json` — `react-dom@19.1.0`, `react-native-web@^0.21.0` web deps eklendi
- `package-lock.json` — yukarıdaki deps
- `src/web-shims/react-native-maps.web.tsx` — **yeni dosya** (dummy MapView/Marker/Polyline/PROVIDER_GOOGLE web shim)
- `app/(app)/driver-ride.tsx` — rating Modal (önceki turn'lerde)
- `app/_layout.tsx` — push deep-link routing
- `src/i18n/locales/{tr,en}.ts` — driverRide.rating* keys
- `src/lib/forceUpdate.ts` — eq('app','fleet')
- `src/lib/jobs.ts`, `src/demo/store.ts` — `ride_request_id: null`
- `src/lib/database.types.ts` — `app_versions.app` + named exports (Job/Profile/Vehicle/...)
- `src/lib/pushNotifications.ts` — routeForPushPayload
- `package.json` — `gen:types` script

**ride:**
- `app.config.js` — Sentry plugin + organization
- `app/(auth)/phone.tsx` — `if (__DEV__ && devSignIn)` gate
- `src/auth/AuthProvider.tsx` — devSignIn `__DEV__ ? ... : undefined`
- `src/hooks/{useActiveRide,usePendingRating}.ts` — AppState invalidation + 5s staleTime
- `src/lib/{sentry.ts,push.ts}` — Sentry init + routeForPushPayload (sentry.ts yeni dosya)
- `src/utils/forceUpdate.ts` — eq('app','ride')
- `metro.config.js` — getSentryExpoConfig
- `eas.json` — serviceAccountKeyPath + SENTRY_DISABLE_AUTO_UPLOAD
- `.env.example` — EXPO_PUBLIC_SENTRY_DSN_RIDE
- `package.json` + `package-lock.json` — @sentry/react-native + gen:types

**workspace:**
- `.github/workflows/build-android.yml` — paths filter
- `.github/workflows/build-android-ride.yml` — **yeni dosya**
- `.github/workflows/release-android-ride.yml` — **yeni dosya**
- `docs/TESTING.md` — v1.4 → v2.0 (Tabula Rasa playbook, baştan yazıldı)
- `docs/test-resume.md` — **yeni dosya (bu doc)**

**Memory:**
- `~/.claude/.../memory/project_ride_state.md` — V2 gaps güncellendi (önceki PR'lardan)

---

## 9. Yeni Session İlk Komutları

1. **DB durum check** (bu doc §3'tekiyle karşılaştır):
   ```
   mcp__supabase__execute_sql project_id=ucitxvsndlwvvnqwabgo query="
     SELECT (SELECT COUNT(*) FROM auth.users) AS users,
            (SELECT name FROM public.organizations LIMIT 1) AS org,
            (SELECT full_name FROM public.profiles LIMIT 1) AS profile,
            (SELECT substr(token,1,6) FROM public.invitations LIMIT 1) AS code;
   "
   ```
   Beklenen: users=1, org=Demir Lojistik, profile=Ayşe Demir, code=233064.

2. **Server check**:
   ```
   mcp__Claude_Preview__preview_list
   ```
   Eğer fleet-web ve ride-web "running" değilse `preview_start` yeniden.

3. **Snapshot fleet-web**:
   ```
   mcp__Claude_Preview__preview_snapshot serverId=39bf9bc8-78f5-4647-b91e-070ba5a32df5
   ```
   "Davet Kodum Var" sonrası kod input ekranını görmelisin. Yoksa **state kaybolmuş** demek (browser session memory clear); `preview_eval window.location.reload()` ve sonra Welcome'dan başla, "Davet Kodum Var" tıkla, kod gir.

4. **Devam et:** [docs/TESTING.md §4](TESTING.md) sırasıyla §5 → §6 → §7 → §8 → §10 → Final Rapor.

---

## 10. Komut Cheat-Sheet

```js
// preview_eval — text-match Pressable click
(() => {
  const els = Array.from(document.querySelectorAll('div, [role="button"], button'));
  const t = els.find(e => (e.textContent||'').trim() === 'BUTON_TEXT');
  if (!t) return { ok: false };
  ['pointerdown','pointerup','click'].forEach(x =>
    t.dispatchEvent(new PointerEvent(x, {bubbles:true, button:0, pointerType:'mouse'})));
  return { ok: true };
})();
```

```js
// preview_eval — password input fill (preview_fill bullet-char placeholder'ı bulamaz)
(() => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  const pwd = Array.from(document.querySelectorAll('input[type="password"]'))[1]; // ikinci pwd input
  setter.call(pwd, 'Test1234!');
  pwd.dispatchEvent(new Event('input', {bubbles:true}));
})();
```

```bash
# DB doğrulama her senaryo sonunda
mcp__supabase__execute_sql ... query="SELECT ... FROM public.X WHERE ..."
```

---

## 11. Final Rapor Çıkartma Notu

Tüm senaryolar bittiğinde:
1. **Bug raporu listesi** — §7 (TESTING.md Bug Bildirim Şablonu)
2. **DB advisor delta**: `get_advisors(type='security')` ve `get_advisors(type='performance')` baseline (session başındaki) ile karşılaştır
3. **Sentry event sayımı**: SDK initialized log + Supabase XHR trace yeterli (Sentry dashboard MCP yok)
4. **Pass/Fail tablosu**: §13 Final Rapor Şablonu
5. **V2 backlog**: BUG-A1/UI1/UI2 için Detox entegrasyonu, react-native-maps web shim'i kalıcı mı geçici mi karar, `filoLocal` DROP SCHEMA, push test infrastructure

**Rapor dosyası adı:** `docs/test-pass-2026-05-16.md` (veya tarih güncelle).

---

*Bu doc önceki session'ın "session dolmadan önce" snapshot'ıdır. Yeni session açıldığında ilk önce `Read C:\Projeler\drivermesh\docs\test-resume.md` ile baştan ortala.*
