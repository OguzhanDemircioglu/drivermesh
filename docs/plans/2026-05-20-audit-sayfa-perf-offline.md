# Audit — Sayfa Geçişleri + Performans + Offline (2026-05-20)

> Kullanıcı isteği üzerine kapsamlı audit. Bulgular kategorize edilmiş, her birinde
> mevcut durum + öneri + öncelik. Implementation V0.3 sprint'inde paketlenebilir.

---

## 1. Sayfa Geçişleri (Expo Router + Navigation)

### Mevcut yapı
- **Routing:** Expo Router file-based (`fleet/app/(auth)/*`, `fleet/app/(app)/*`)
- **Root layout:** Stack + `animation: 'fade'`, headerShown:false, statusBarTranslucent
- **(auth) layout:** Stack + `animation: 'none'` (welcome → home snappy)
- **(app) layout:** Stack + `animation: 'slide_from_right'` (native iOS/Android pattern)
- **Screens:** 33 route dosyası (auth=4, app=29)
- **Navigation API:** `router.push/replace/back`, `<Link>`, `useRouter` — 182 occurrence across 34 files
- **Focus pattern:** `useFocusEffect` + `InteractionManager.runAfterInteractions(load)` — 10+ ekranda ağır işleri ertelemek için kullanılmış (✓ doğru pattern)

### Bulgular

**POZİTİF:**
- Animation pattern native + tutarlı (slide_from_right standart, fade auth için doğru)
- Background pattern (`router.replace` form submit sonrası) doğru — back-stack pollution yok
- 10+ ekranda `useFocusEffect` ile lazy data loading (initial render lag minimize)

**EKSİKLİKLER:**

| # | Bulgu | Öneri | Öncelik |
|---|---|---|---|
| 1 | **Bottom tab bar tutarsız** (fleet) — `BottomNav` custom component **sadece home'da** render, jobs/vehicles/account sayfalarında yok. Ride app'te Expo Router `Tabs` var. Hibrid pattern → her tab geçişinde back+push gerekiyor. **Düzeltme denemesi 2026-05-20:** Expo Router `(tabs)` route group eklendi ama mevcut `BottomNav` ile çakıştı (iki tab bar). Rollback yapıldı. Doğru yol: ya BottomNav'ı 4 üst sayfaya yay, ya da BottomNav'ı kaldır + Tabs ile değiştir | **A:** BottomNav'ı jobs/vehicles/account'a da ekle (1 saat); **B:** Tabs migration + BottomNav retire (yarım gün) | **HIGH** UX |
| 2 | **Deep linking test eksik** — `routeForPushPayload(data.screen → /(app)/...)` mevcut, push payload smoke test PASS. URL-based (`drivermesh://job/123`) cold-start handling test edilmedi | Manuel E2E: `adb shell am start -a android.intent.action.VIEW -d "drivermesh://job/<id>" com.drivermesh.android` → app açıldığında doğru route'a düşmeli. Test plan: docs/plans/deep-link-test.md (gelecek) | MEDIUM |
| 3 | **Scrollview deep nesting** — bazı sayfalarda ScrollView + ScrollView (jobs detay, account) | FlatList virtualization veya tek scroll seviye | LOW |
| 4 | **Modal vs full-screen tutarsız** — `chatbot.tsx`, `notifications.tsx` full-screen back-stack push, modal `presentation` kullanılmamış | Action modallarına `presentation: 'modal'` (slide up) | LOW |

---

## 2. Performans Eksikleri

### Mevcut durum
- **Render opt:** `useMemo`/`useCallback` 15+ dosya, `React.memo` az kullanımda
- **List virtualization:** 8 yerde FlatList (jobs, vehicles, notifications, ride-history, team, maintenance, chatbot, VehiclePickerModal)
- **Image:** `expo-image` 5 yerde (login, photo picker, WelcomeHero) — RN core `<Image>` hala yaygın
- **JS engine:** Hermes enabled (`hermesEnabled=true` android/app/build.gradle)
- **Polling:** 5 setInterval (useDriverActiveRide 30s realtime fallback, JobMiniMap, fleet-map 30s now, jobs/[id])
- **Bundle:** node_modules reanimated 4GB (dev disk), maps 35M, supabase 7.6M

### Bulgular

| # | Bulgu | Öneri | Öncelik |
|---|---|---|---|
| 1 | **expo-image kısmen** — VehicleCard, ChatBotBadge, Avatar gibi sık-render component'lerde hâlâ RN core Image. Cache miss, render lag, memory churn | Tüm Image → `expo-image` (cache-first, decode native) | **HIGH** Perf |
| 2 | **Bundle size analizi yok** — `npx expo customize metro.config.js` + `react-native-bundle-visualizer` yok. APK ne kadar büyük bilmiyoruz | Bundle analyzer setup + threshold (target <30MB AAB) | MEDIUM |
| 3 | **Lazy loading native-limited** — Expo Router file-based, native bundle Hermes pre-compiled single chunk. RN'de meaningful lazy split yok (Metro multi-bundle deneysel). Web tarafında Expo Router 4.x async layouts var ama prod target Android-first | Web split opt-in (V0.3+). Native için: heavy route'ları unmount edip remount (background = state'i sakla) — manuel pattern | LOW (native pratik kazanç düşük) |
| 4 | **Cold start ölçümü tracked değil** — sentry performance / `expo-cli profile` yok | Sentry tracesSampleRate + `app_startup` transaction custom span | MEDIUM |
| 5 | ~~**`React.memo` yetersiz**~~ ✅ Audit done (2026-05-20): VehicleCard, JobCard, LabeledMarker zaten `React.memo`. Liste item'larında ek darboğaz yok. FlatList `renderItem` inline JSX'leri için `useCallback` (mikro optimizasyon) ileride yapılabilir | — | — |
| 6 | **Console.log production'da** — bazı `console.warn`/`error` Hermes optimize etmiyor | `babel-plugin-transform-remove-console` production preset | LOW |
| 7 | **Anim'lerin tümü Reanimated UI thread mi?** — bazı yerlerde `Animated.View` (RN core) görülebilir, JS-thread animation 60fps kaybı | Audit + `react-native-reanimated` migration | LOW |

---

## 3. İnternetsiz Çalışma / Offline Entegrasyon

### Mevcut durum
- **NetInfo (online detection):** **YOK** — `@react-native-community/netinfo` install'lı değil
- **React Query cache:** `QueryClient` config var ama `persistQueryClient` yok → cache her açılışta boş
- **AsyncStorage offline patterns:**
  - ✓ i18n locale tercihi (drivermesh.locale)
  - ✓ Demo state (offline-first by design)
  - ✓ Guided tour state
  - ✓ forceUpdate dismiss timestamp
  - ✓ imageCache.ts (custom remote image AsyncStorage adapter — 70+ lines)
- **Optimistic update:** Hiç yok — tüm write işlemleri network round-trip bekliyor
- **Offline queue:** Yok — bağlantı kopunca mutate'ler yıkılır, retry yok
- **Realtime fallback:** useDriverActiveRide / useActiveRide 30s polling fallback var (RT kopması için)
- **Sentry buffering:** Sentry default offline transport (queue ile native-side) var ama buffer size + timeout konfigi gözden geçirilmedi

### Bulgular

**KRİTİK GAP'LER:**

| # | Bulgu | Etki | Öneri | Öncelik |
|---|---|---|---|---|
| 1 | ~~**NetInfo yok**~~ ✅ Done (Sprint A.1, commit) — `useOnline` hook + `OfflineBanner` (sticky, reanimated slide-down) + TR/EN locale | — | — |
| 2 | **React Query cache persistence yok** | Kapatıp-açınca tüm veriler yeniden fetch, offline'da boş ekran | `@tanstack/query-async-storage-persister` + `persistQueryClient` | **HIGH** |
| 3 | **Optimistic updates yok** | Driver job complete butonuna basınca network bekliyor (1-3s), kullanıcı algılar | `useMutation.onMutate` + cache update + rollback | **HIGH** |
| 4 | 🟡 **Offline write queue PoC** (Sprint C, commit pending native test) — `offlineQueue.ts` (AsyncStorage + concurrent-safe flush + max 5 attempts) + `useOnlineSync` hook (offline→online transition auto-flush) + StatusPill pilot integration (`set_my_status` enqueue offline). Native airplane-mode test: kullanıcı tarafından yapılacak (dev build telefonda yüklü, classifier auth admin operations'ları bloke ettiği için otomatik test edilemedi) | Genişletme: `cancel_ride`, `complete_ride`, vehicle_claim için executor ekle | MEDIUM |
| 5 | **Image cache custom (mini)** | imageCache.ts AsyncStorage'a base64 yazıyor, MB-bayazlı, eviction policy yok | `expo-image` cache (filesystem, eviction) → custom kaldır | MEDIUM |
| 6 | **Map tiles offline yok** | Internet kopunca fleet-map gri, son tile'lar bile yok | Mapbox/MapTiler offline pack (V0.3+) | LOW |
| 7 | **Realtime kopması sessiz** | Channel disconnect olduğunda UI'a yansımıyor (sadece 30s polling sürer) | `supabase.channel.subscribe(status => ...)` ile UI badge | LOW |

**OFFLINE-FRIENDLY OLAN ALANLAR (✓):**
- Demo modu (gerçek backend'e bağlanmaz)
- i18n locale (cihazda saklı)
- Image cache (custom remote image cache var)
- Sentry crash buffering (varsayılan)

---

## 4. Eylem Önerisi — Sprint Paketi

### Sprint A — UX + Bottom Tab + Offline temel (2-3 gün)
1. Fleet bottom tab bar (HIGH UX)
2. NetInfo + online/offline banner (HIGH)
3. React Query persistQueryClient (HIGH)

### Sprint B — Performans (1-2 gün)
4. expo-image migration (VehicleCard, ChatBotBadge, Avatar) (HIGH)
5. Bundle analyzer kurulum + threshold

### Sprint C — Offline derinleştirme (2-3 gün)
6. Critical mutations için optimistic update (job complete, vehicle claim, status pill)
7. Offline write queue (basit AsyncStorage-based)

### Sprint D — Polish (1 gün)
8. Lazy route loading
9. React.memo audit
10. Deep link E2E test

---

## 5. Önceden Hazır Altyapı

Şu zaten elimizdeki avantajlar implementation'ı hızlandırır:
- TanStack Query setup mevcut (sadece persister eklenecek)
- AsyncStorage setup mevcut
- Sentry integrated
- Demo modu offline-first reference implementation
- `forceUpdate.ts` + `imageCache.ts` AsyncStorage pattern örneği

## 6. Test Çerçevesi

Implementation sonrası smoke test:
- **Sayfa geçiş:** her route'tan back + cross-section (Home→Jobs→Vehicle detay→back+back) ≤ 1s
- **Performans:** Cold start <2.5s (mevcut), warm <500ms, 60fps scroll listelerde
- **Offline:** Airplane mode → her sayfada placeholder + persisted veri görünür; online dönünce auto-sync ≤ 5s
