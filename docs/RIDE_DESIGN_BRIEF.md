# DriverMesh Ride — UI/UX Tasarım Brief'i

> Bu doküman Claude Design'a (ya da herhangi bir UI tasarım aracına) verilebilecek formatta hazırlanmıştır. Tasarımcı bu brief'i okuyup mockup üretir; mühendislik sonra mockup'ı React Native + Expo Router ile uygular.
>
> **Tarih:** 2026-05-14
> **Hedef platform:** iOS + Android (mobile-first, portrait, edge-to-edge)
> **Hedef ölçü:** 390×844 (iPhone 14) referans; Android 360–412 dp genişlik

---

## 1. Ürün özeti

**DriverMesh Ride** — mevcut DriverMesh filo yönetim ekosisteminin **müşteri/yolcu uygulamasıdır**. Uber/BiTaksi benzeri ride-hailing akışı: yolcu telefon doğrulamayla kaydolur, pickup ve dropoff seçer, bir aracı çağırır, en yakın filo şoförüne push düşer, kabul edince yolculuk başlar.

**Kapsam (eksiksiz v1.0 — bu brief'te tasarlanacak):**
- Tek şehir (İstanbul), tek araç tipi (standard), statik tarife (₺30 base + ₺12/km + ₺2/dk, min ₺50)
- **Kapıda nakit** — uygulama para akışına dokunmaz, sadece tahmini ücret gösterir, komisyon yok
- TR (default) + EN (canlı dil değiştirme Account'tan)
- **DAHİL:** Rating sistemi, Trip Detail ekranı, Edit Profile, Help/Support, Notifications ekranı, Address book (favori + geçmiş), Push notifications (FCM Android + APNs iOS — zorunlu, SMS sadece signup'ta)
- **Out of scope (V2'ye kalan):** Kart ödeme (iyzico), scheduled ride, multi-stop, in-app cüzdan, surge pricing, in-app chat, female driver preference, promo/loyalty

**Aktör:** Sadece yolcu. Şoför mevcut DriverMesh fleet app'inden çalışır (yeni app yüklemez), patron/yönetici fleet app'inden Ride entegrasyonunu toggle eder.

---

## 2. Marka ve görsel dil

**Drivermesh fleet** ile birebir aynı görsel dile sahip olmalı — aynı şirketin iki uygulaması. Yolcu app'i operasyonel dashboard değil, **harita-merkezli, az tıkla, Uber benzeri tek-amaçlı bir akış**.

### Palet

| Token | Hex | Kullanım |
|---|---|---|
| `bg` | `#0A0E1F` | Tüm ekran ana arka plan (koyu lacivert) |
| `bgElevated` | `#131829` | Input/card raised yüzey |
| `surface` | `#1A2038` | Focus durumda input dolgu, modal sheet |
| `accent` | `#FF7A1A` | Birincil CTA, focus, vurgu (turuncu) |
| `accentHover` | `#FF8C3D` | Gradient stop |
| `mesh` | `#5B7FFF` | Pickup pini, mavi vurgu, secondary chip |
| `lavender` | `#B89AF0` | Brand vurgusu, "DriverMesh" wordmark'taki "Mesh" yazısı |
| `text` | `#F5F7FA` | Birincil metin |
| `textMuted` | `#8A93A6` | İkincil metin, etiket |
| `textDim` | `#5B6478` | Placeholder, dim ipucu |
| `success` | `#22C55E` | Tamamlandı, doğrulama |
| `danger` | `#EF4444` | Hata, iptal |
| `warning` | `#F59E0B` | Uyarı, ödeme bekliyor |

### Tipografi

- **Font:** Noto Sans (Google Fonts, SIL OFL). Verdana benzeri ferah karakter, Türkçe diakritikler temiz.
- **Boyutlar:** xs 15 / sm 16 / base 18 / md 19 / lg 21 / xl 25 / 2xl 31 / 3xl 37 / 4xl 45
- **Ağırlıklar:** regular 400, medium 500, semibold 600, bold 700, black 800
- **Letter spacing:** sıfır (label/etiketler `0.6` letter-spacing + uppercase)

### Spacing & shape

- **Spacing scale:** 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64
- **Border radius:** 8 / 12 / 16 / 20 / 28 / full(9999)
- **Border:** rgba(255,255,255,0.08) hairline; strong rgba(255,255,255,0.16)
- **Shadow:** Android elevation 2-6; iOS shadowOffset y=2 shadowOpacity=0.25 shadowRadius=8

### Arka plan kompozisyonu

Tüm "auth" ve "splash" ekranlarda aynı mesh-bg pattern:
- Base: `LinearGradient` köşegen `#0A0E1F → #0E1530 → #0A0E1F`
- Üstte radial glow turuncu (`#FF7A1A` %18 opacity, üst-orta)
- Sağ alt radial glow mavi (`#5B7FFF` %18 opacity)
- Dekoratif SVG ağ (10 nokta + 14 çizgi, opacity 0.45, mavi mesh rengi) tüm yüzeye dağılmış

Harita-merkezli ekranlarda mesh-bg yok — Google Maps koyu tema baskın.

### Komponent stili (referans)

**Button (primary):**
- Height 54, radius 16
- LinearGradient `#FF8C3D → #FF7A1A → #F36300` köşegen
- Text: koyu lacivert `#0A0E1F`, semibold, letter-spacing 0.2
- Pressed: scale 0.98, opacity 0.92

**Button (secondary):**
- Aynı height/radius, surface arka plan + 1px border + text rengi `#F5F7FA`

**TextField:**
- Height 54, radius 16, `bgElevated` dolgu, 1px hairline border
- Üst etiket: xs, uppercase, letter-spacing 0.6, color `textMuted`
- Focus: border accent + dolgu surface; label color accent
- Hata: border danger + dolgu `dangerMuted` (`rgba(239,68,68,0.12)`); errorText xs altta

**Card:**
- Radius 16, surface bg + 1px hairline border, padding 16-20

---

## 3. Ekran haritası (akış)

```
[Splash] → Welcome ──→ Phone ──→ OTP ──→ Profile Setup ──→ Home (Ana sekme)
                                                              │
                                  ┌─── History (sekme) ───────┤
                                  │       │                   │
                                  │       └─→ Trip Detail     │
                                  │                           │
                                  └─── Account (sekme) ───────┤
                                          │                   │
                                          ├─→ Edit Profile    │
                                          ├─→ Notifications   │ (üst çan ikonu da buraya)
                                          ├─→ Address Book    │
                                          ├─→ Language        │
                                          └─→ Help/Support    │
                                                              │
                                                     [tap "Nereye gidiyorsun?"]
                                                              ▼
                                                       Pickup Picker
                                                              ▼
                                                       Dropoff Picker
                                                              ▼
                                                       Ride Confirm
                                                              ▼
                                                       Searching ◄── push: ride_searching_started
                                                              ▼
                                                       Active Ride ◄── push: ride_assigned / driver_arrived / started
                                                              ▼
                                                       Ride Complete ◄── push: ride_completed
                                                              ▼
                                                       Rating
                                                              ▼
                                                       back to Home
```

**Toplam ekran sayısı:** 18 (auth 4 + ana akış 7 + nav 3 + alt ekranlar 4).

**Bottom nav (3 sekme — final):** Ana / Geçmiş / Hesap. Bildirimler ana sayfanın **üst sağ köşesinde çan ikonu** olarak duracak (badge ile unread sayısı); ayrı sekme YOK.

---

## 4. Ekran tek tek brief

### Ekran 1 — Welcome

**Amaç:** İlk açılış, brand'i göster ve telefon CTA'sıyla yolculuğa başlat.

**Layout (top → bottom):**
1. **Header bölgesi (üstten ~%25):**
   - Merkezde Logo (84×84, radius %22)
   - Logo altında brand wordmark: "**DriverMesh**" — "Driver" beyaz, "Mesh" lavender (`#B89AF0`)
2. **Hero bölgesi (orta):**
   - Title: "Nereye\ngidiyorsun?" (2 satır, 3xl 37px bold)
   - Subtitle (md 19px muted): "Sana en yakın aracı kapına çağır, dakikalar içinde yola çık."
3. **Actions (alt):**
   - Primary CTA: "Telefonla başla" (gradient turuncu)
   - Footnote (xs textDim, letter-spacing 1.4, uppercase): "YOLCU UYGULAMASI"

**State'ler:** Sadece idle.
**Animasyon:** Mesh-bg arka plandaki ağ noktaları açılışta hafif fade-in (200ms).

---

### Ekran 2 — Phone

**Amaç:** TR mobil telefon numarası al, OTP gönder.

**Layout:**
1. **Header (üstten ~%20):**
   - Title: "Telefon numaran" (2xl 31px bold)
   - Subtitle (md muted): "Sana 6 haneli bir doğrulama kodu göndereceğiz."
2. **Form:**
   - Yan yana iki alan:
     - **Sol chip:** "+90" (fixed, 54 height, bgElevated, border, semibold)
     - **Sağ TextField:** label "Cep telefonu", placeholder "5XX XXX XX XX", keyboardType number-pad, 10-hane max, autoFocus
   - Format: kullanıcı yazarken otomatik "5XX XXX XX XX" boşluklarıyla göster
3. **Action:**
   - "Kodu gönder" primary CTA, disabled iken opacity %50, valid iken aktif

**State'ler:**
- `idle`: input boş, CTA disabled
- `typing`: 1-9 hane, CTA disabled
- `valid` (10 hane + `5` ile başlıyor): CTA active
- `submitting`: CTA loading spinner
- `error`: input border kırmızı + altta error metni "Geçerli bir cep telefonu numarası gir."

**Klavye:** number-pad açılır, Return → submit.

---

### Ekran 3 — OTP Verify

**Amaç:** SMS ile gönderilen 6-haneli kodu doğrula.

**Layout:**
1. **Header:**
   - Title: "Doğrulama kodu" (2xl bold)
   - Subtitle: "+90 5XX XXX XX XX numarasına gönderilen 6 haneli kodu gir." (telefon dinamik, lavender vurgulu olabilir)
2. **Form:**
   - Tek TextField (label "Kod", placeholder "000000", number-pad, 6 hane max). **Veya** 6 ayrı box (Apple-Pay style) — Claude Design daha estetik olanı seçsin.
   - Alt: Resend ipucu
     - Aktif değil: "30 sn sonra tekrar gönderebilirsin" (textDim)
     - Aktif: "Kodu yeniden gönder" (accent renkli, tappable)
3. **Action:**
   - "Doğrula" primary CTA, 6 hane girilince active

**State'ler:**
- `countdown`: 60sn geri sayım
- `resend_active`: countdown bitti, resend tıklanabilir
- `verifying`: CTA loading
- `error`: "Kod hatalı veya süresi dolmuş." kırmızı

**Geri butonu:** üst sol, ok (`chevron-left`), telefon ekranına geri.

---

### Ekran 4 — Profile Setup

**Amaç:** İlk girişte yolcunun adını al. Şoför bu adı görür.

**Layout:**
1. **Header:**
   - Title: "Seni nasıl tanıyalım?" (2xl bold)
   - Subtitle: "Şoför sana ulaşırken bu adı görecek."
2. **Form:**
   - TextField: label "Ad soyad", placeholder "Örn. Ayşe Yılmaz", autoCapitalize words, autoFocus
3. **Action:**
   - "Devam et" primary CTA (2+ karakter girilince active)
   - Altta "Sonra" ghost link (skip, customer row yine oluşur, full_name NULL kalır)

**State'ler:** idle / typing / submitting

---

### Ekran 5 — Home (ana ekran)

**Amaç:** Yolcunun "Nereye gidiyorsun?" akışını başlatacağı merkez ekran.

**Layout (üstten alta):**
1. **Top bar (safe area + 16px):**
   - Sol: Avatar (32×32 daire, ilk harf veya foto) — Account'a kestirme
   - Sağ: Bildirim çanı ikonu (sağ üst, badge unread sayısı)
2. **Harita (full height eksi top bar eksi bottom sheet):**
   - Google Maps koyu tema
   - Yolcunun mevcut konumu mavi pulse pin
   - HQ/araç pin'i YOK (bu yolcu app'i, fleet pin'i göstermez — V1'de yakındaki müsait araçları küçük gri pin olarak gösterebilir, MVP'de hayır)
3. **Bottom sheet (40dp yukarıdan başlayıp 220dp yüksekliğe açılabilir):**
   - **Greeting:** "Merhaba Ayşe 👋" (lg, semibold) + saat bazlı: Günaydın/İyi günler/İyi akşamlar
   - **Big search bar (54 height, radius 16, bgElevated, border):**
     - Sol ikon: lavender daire + beyaz "arrow-up-right" Feather icon
     - Placeholder: "Nereye gidiyorsun?"
     - Tap → Pickup Picker route (önce pickup'ı belirle, sonra dropoff)
   - **"Son adreslerin":**
     - MVP'de boş ise → "Yolculuk yaptıkça burada görünür" textDim küçük yazı
     - V1+: son 3 destination, ikon (Feather "map-pin") + adres tek satır truncate
4. **Bottom nav (60dp, sticky):**
   - 3 sekme: **Ana** (icon "home"), **Geçmiş** (icon "list"), **Hesap** (icon "user")
   - Active: accent renk + label; passive: textDim
   - Bottom nav fleet ile aynı pattern (drivermesh/src/components/BottomNav.tsx referans)

**State'ler:**
- `locating`: harita yüklenirken merkezde "Konumun bulunuyor…" toast
- `denied_permission`: konum izni reddedildi → big search yine çalışır, ama harita İstanbul'un merkezi göstersin (Galata)
- `loaded`: full state

---

### Ekran 6 — Pickup Picker

**Amaç:** Pickup noktasını harita üstünden seç + adresi reverse-geocode et.

**Layout:**
1. **Top bar:**
   - Sol: `chevron-left` geri
   - Merkez: "Nereden binilecek?" (md semibold)
   - Sağ: yok
2. **Search bar (top bar altında, 12px padding):**
   - Adres ara TextField (icon "search" sol, "x" temizle sağ)
   - Tap → modal açabilir (V1+); MVP'de inline çalışır
3. **Harita (full):**
   - Merkezde sabit pin (mavi mesh `MiniLocationPin` — drivermesh fleet'ten kopyalı)
   - Harita pan/zoom edilebilir; pin sabit, harita altta hareket eder
   - Sağ alt FAB: "Konumum" — `crosshair` ikon, accent renk, dairesel; tap → mevcut konuma snap
4. **Address card (harita alt, 100dp yüksek, bgElevated, radius 20):**
   - Üst: reverse-geocoded adres (Türkçe, 2 satır truncate). Yüklenirken "Adres bulunuyor…" textDim
   - Alt: koord ("41.0256, 28.9742") küçük textDim — debug için, V1'de gizlenebilir
5. **CTA (alt 16px padding):**
   - "Bu noktayı seç" primary, full width

**State'ler:**
- `locating`: harita center loading
- `geocoding`: pin durunca 500ms debounce sonra reverse-geocode
- `selected`: tap CTA → push Dropoff Picker, params: pickup_lat, pickup_lng, pickup_address

---

### Ekran 7 — Dropoff Picker

**Amaç:** Dropoff noktasını seç.

**Layout:** Pickup Picker ile **birebir aynı**, sadece:
- Pin rengi **turuncu accent** (`MiniLocationPin variant='dropoff'`)
- Title: "Nereye gidilecek?"
- CTA: "Aracı çağırma adımına geç"

**Akış:** Tap CTA → Ride Confirm route, params: pickup_*, dropoff_*

---

### Ekran 8 — Ride Confirm

**Amaç:** Yolcunun seçimini özetle, fiyatı göster, "çağır" butonu.

**Layout (üstten alta):**
1. **Top bar:**
   - Sol: `chevron-left` geri (Dropoff Picker'a geri)
   - Title: "Yolculuğunu onayla"
2. **Route summary card (radius 20, bgElevated, 16px padding):**
   - Sol: dikey timeline (mavi nokta → turuncu pin), aralarında 2px dikey çizgi `textDim`
   - Sağ: 2 satır
     - "Nereden": pickup_address (semibold, truncate 2 satır)
     - "Nereye": dropoff_address (semibold, truncate 2 satır)
3. **Mini-map (180dp yüksek, radius 16):**
   - Pickup → dropoff arasında pickup pin + dropoff pin + dashed kırmızı `#F87171` polyline (drivermesh fleet'tekiyle aynı stil)
4. **Trip details card (3 satır, ikonlu):**
   - 🚗 "Araç tipi: **Standart**" (V1'de seçici)
   - 📍 "Mesafe: **18.4 km** • Süre: **32 dk**"
   - 💵 "Ödeme: **Kapıda nakit**" (ikon `dollar-sign` veya `banknote`)
5. **Fare highlight (büyük, radius 16, accentMuted bg):**
   - Sol: "Tahmini ücret" (sm textMuted)
   - Sağ: "₺145" (3xl 37px bold accent) + altında "*Mesafeye göre değişebilir*" (xs textDim)
6. **CTA:**
   - "Aracı çağır" primary, full width, height 60 (büyük); altta gri textDim disclaimer: "Aracı çağırınca yakındaki şoföre bildirim gider."

**State'ler:**
- `quoting`: yüklenirken fare card placeholder "₺— hesaplanıyor"
- `quoted`: fare gösterilir
- `dispatching`: CTA loading

---

### Ekran 9 — Searching

**Amaç:** Şoför aranıyor durumunu görselleştir + iptal seçeneği.

**Layout:**
1. **Full screen harita:** pickup pin sabit merkezde
2. **Pulse animasyon:** pickup pin etrafında 3 katmanlı turuncu pulse halka (1.5s döngü, fade-out scale 1→2.5)
3. **Bottom sheet (240dp, bgElevated, radius top 28):**
   - "Şoför aranıyor…" (xl 25 bold)
   - Subtitle: "Tahmini bekleme **2-4 dk**" (md, "2-4 dk" accent)
   - Mini loading bar (accent renkte, infinite shimmer)
   - Alt ghost link: "İptal et" (textMuted)
4. **Top bar:** sadece geri butonu — yok, çünkü kullanıcı iptal ile döner

**State'ler:**
- `searching`: pulse + bar shimmer
- `assigned`: bottom sheet replace → Active Ride
- `no_drivers`: pulse durur, "Şu an müsait şoför yok" + "Tekrar dene" / "İptal et"
- `cancelled_by_user`: confirm modal → home

---

### Ekran 10 — Active Ride

**Amaç:** Aktif yolculuğu canlı takip; şoför + araç bilgisi + ETA + status.

**Layout (3 ana state'i göz önünde):**

**State A — `assigned` (şoför yolda pickup'a):**
- Full harita: araç (`LabeledMarker` pill — fleet'tekiyle aynı, plate-color), pickup pini, polyline (araç → pickup)
- Bottom sheet (260dp):
  - Status pill üstte: 🚗 "Şoför yolda • ETA **3 dk**"
  - Driver kartı (yatay):
    - Sol: driver avatar (40×40 daire, ilk harf veya foto)
    - Orta: "Ahmet Yılmaz" (semibold) + altta "★ 4.8 • 247 yolculuk" (xs muted) — MVP'de rating yok, sadece ad/plaka
    - Sağ: "Ara" buton (mavi `mesh`, "phone" ikon)
  - Araç kartı (yatay):
    - Plate badge (drivermesh fleet'tekiyle aynı plate-color thumb)
    - "Ford Transit • Beyaz"
  - Alt ghost link: "İptal et" (danger ton)

**State B — `driver_arrived` (şoför pickup'a vardı):**
- Bottom sheet replace: yeşil success rozeti + "Şoför geldi! Aracı bul ve bin." (lg bold)
- Aynı driver + vehicle kartları
- "Ara" buton büyür (focus state)

**State C — `in_progress` (yolculuk başladı):**
- Full harita: araç, pickup geçildi, dropoff'a doğru hareketli polyline
- Bottom sheet:
  - Status: "Yoldayız • Varış **18 dk**"
  - Live timer (drivermesh fleet'in `LiveTimerCard`'ı gibi büyük 00:00:00)
  - Driver+vehicle kartı (compact)
  - Alt: "Acil durum" ghost (V2)

---

### Ekran 11 — Ride Complete

**Amaç:** Tamamlandığını söyle + özet + dönüş.

**Layout (modal-like, full screen):**
1. **Success animasyon** (üstten ~%25):
   - Yeşil daire (success bg, %20 opacity halo) + check ikonu büyük (`#22C55E`, 64px)
   - Scale-in animasyon (300ms cubic)
2. **Title:** "Yolculuğun tamamlandı 🎉" (2xl bold)
3. **Trip summary card:**
   - Route mini (pickup → dropoff 2 satır)
   - Stats: "**18.4 km** • **32 dk** • ₺**145**" (md, sayılar accent)
   - "Şoför: Ahmet Yılmaz • 34 ABC 123"
4. **Payment reminder card (bgElevated, border):**
   - 💵 "Kapıda nakit ödemeyi unutma"
   - "₺145 ödenecek" textMuted
5. **CTA:**
   - **"Şoförü değerlendir"** primary, full width → Rating ekranına push
   - Altta ghost link "Sonra" → Home'a dön (rating skip edilir, sonra bildirimden geri dönebilir)

**State'ler:**
- `paid_cash_default`: yukarıdaki layout
- `cancelled_*`: success yerine kırmızı X ikonu + "Yolculuk iptal edildi" + sadece "Tamam" buton

---

### Ekran 12 — History

**Amaç:** Geçmiş yolculukları liste halinde göster.

**Layout:**
1. **Top bar:**
   - Title: "Geçmiş yolculukların" (xl semibold)
   - Sağ: filter ikonu (V1+: tarihe göre filtre)
2. **Liste:**
   - Her kart (radius 16, bgElevated, 16px padding, 12px gap):
     - Üst satır: tarih + saat (sm muted) **+** status badge sağda:
       - `completed` → success rozet "Tamamlandı"
       - `cancelled_*` → danger rozet "İptal"
       - `no_drivers_available` → warning "Şoför bulunamadı"
     - Orta: route mini (pickup → dropoff, 2 satır truncate)
     - Alt satır: stats: "18.4 km • 32 dk • ₺145" (sm) + sağda "›" chevron
   - Liste boşsa: ortada empty state (ikon "map", title "Henüz yolculuk yok", subtitle "İlk yolculuğunu yapınca burada görünür")

**State'ler:**
- `loading`: 3 skeleton kart
- `empty`: empty illustration
- `loaded`: kartlar
- `pagination`: V1+ infinite scroll

---

### Ekran 13 — Account

**Amaç:** Profil + ayarlar + çıkış.

**Layout:**
1. **Top bar:**
   - Title: "Hesabım"
2. **Profil kartı (lg, üstte):**
   - Avatar büyük (64×64 daire) — ilk harf veya foto
   - Ad soyad (xl semibold)
   - Telefon (md muted, "+90 5XX XXX XX XX")
   - Sağ: "Düzenle" ghost link (kalem ikonu)
3. **Menü kartları (her biri 56 height, radius 16, bgElevated):**
   - 🌐 "Dil" sağda chevron + mevcut "Türkçe" textDim — tap modal "TR/EN seçici"
   - ❓ "Yardım" — tap "destek formu" (V1+ Telegram)
   - 📜 "Yasal" — Gizlilik + KVKK + Hizmet şartları
   - 📱 "Sürüm" sağda v0.1.0 textDim
4. **Çıkış kartı (alt, ayrı, danger ton):**
   - "Çıkış yap" — kırmızı ikon `log-out` + danger renkli metin
   - Tap → confirm modal "Çıkış yap / Oturumunu kapatmak istiyor musun?"
5. **Bottom nav:** Hesap aktif

---

## 5. Ortak komponentler

### Bottom nav (3 sekme)

- Height 60 + safe-area-bottom, bg `bgElevated`, üst hairline border
- 3 sekme eşit dağılım:
  - **Ana** (`home`)
  - **Geçmiş** (`list`)
  - **Hesap** (`user`)
- Active: ikon + label `accent`; passive: `textDim`
- Tap: route replace (stack reset)

### Confirm modal (drivermesh fleet `ConfirmDialog` pattern)

- Modal (full backdrop dim %50)
- Center sheet (radius 20, surface bg, padding 24, gap 12)
- 3 variant: `default` (turuncu), `destructive` (kırmızı), `warning` (amber)
- Buttons: ghost cancel sol + filled action sağ

### Toast (drivermesh fleet `Toast` pattern)

- Slide-down top, 3sn auto-dismiss
- 4 variant: success / error / info / warning
- Tap to dismiss

---

## 6. Etkileşim ve animasyonlar

- **Splash → Welcome:** SplashScreen.hideAsync sonrası fade-in (300ms)
- **Stack push:** slide_from_right (Expo Router native default), 250ms
- **Stack replace:** fade (200ms)
- **Bottom sheet:** spring (damping 18, stiffness 200), pull-to-dismiss YOK (statik konumdaysa)
- **Pulse halka (Searching):** infinite scale 1→2.5 + opacity 0.6→0, 1500ms ease-out, 3 katman 500ms stagger
- **CTA pressed:** scale 0.98, opacity 0.92, 80ms (instant feel)

---

## 7. Erişilebilirlik

- Tüm interactive element'lerin min target size 44×44pt (iOS HIG) / 48×48dp (Material)
- Renk kontrastları WCAG 2.2 AA — koyu lacivert üstü beyaz/textMuted ≥ 4.5:1 (check edildi)
- Focus halkaları visible (TextField focus border 2px accent)
- Screen reader label'lar tüm icon-only buton'larda mevcut
- Klavye accessibility: Return → submit, geri butonu hardware/swipe

---

---

### Ekran 14 — Rating

**Amaç:** Yolcunun şoförü 1-5 yıldız + opsiyonel yorumla değerlendirmesi. Rating eksiksiz v1.0'a dahil çünkü güven mekanizması.

**Layout:**
1. **Top bar:**
   - Sol: `x` (skip — geri ride complete'e/home'a)
   - Title: "Yolculuğu değerlendir" (lg semibold, center)
2. **Driver kartı (center, üstten ~%25):**
   - Avatar büyük (80×80 daire)
   - "Ahmet Yılmaz" (xl semibold)
   - "Ford Transit • 34 ABC 123" (sm muted)
3. **Yıldız picker:**
   - 5 yıldız, her biri 48×48pt tappable, gap 16
   - Boş yıldız outline `textDim`, seçili `#F59E0B` warning altın
   - Hover/press: scale 1.1 spring
   - Yıldız altında etiket dinamik: "Hiç beğenmedim / Beğenmedim / Fena değil / Beğendim / Mükemmel" (seçime göre)
4. **Hızlı etiketler (chip seçici, multiSelect):**
   - Yıldız sayısına göre değişen chip set'i:
     - ≥4 ⭐: "Nazikti", "Temiz araç", "Hızlı vardı", "Müzik güzel", "Sessizdi"
     - ≤3 ⭐: "Geç kaldı", "Saygısızdı", "Araç kirli", "Hız yaptı", "Telefonla konuştu"
   - Chip stili: radius full, surface bg, border. Seçili: accent border + accentMuted bg
5. **Yorum (opsiyonel):**
   - TextField multiline (height 80), label "Yorumun (opsiyonel)", placeholder "Şoförle yolculuğun nasıldı?"
6. **CTA:**
   - "Gönder" primary, full width — yıldız seçilince active
   - Altta ghost "Sonra" — skip

**State'ler:**
- `idle`: 0 yıldız, CTA disabled
- `rated`: yıldız seçildi, chip'ler güncellendi
- `submitting`: CTA loading
- `submitted`: kısa toast "Teşekkürler 🙏", 1sn sonra Home'a redirect

---

### Ekran 15 — Trip Detail

**Amaç:** History'den bir yolculuk seçilince tüm detayları göster.

**Layout (scrollable):**
1. **Top bar:**
   - Sol: `chevron-left` (History'ye geri)
   - Title: "Yolculuk Detayı" (lg semibold)
2. **Status badge** (üst, geniş): "Tamamlandı ✓" yeşil veya "İptal edildi" kırmızı, vb.
3. **Mini-map (200dp):**
   - Pickup pin + dropoff pin + dashed kırmızı polyline (Ride Confirm'deki mini-map ile birebir)
4. **Tarih/Saat kartı:**
   - "23 Mart 2026, Pazartesi"
   - "Talep: 14:35 • Başlangıç: 14:42 • Bitiş: 15:14" (3 satır timeline)
5. **Route kartı:**
   - Timeline (mavi nokta → turuncu pin)
   - Pickup full address
   - Dropoff full address
6. **Şoför kartı:**
   - Avatar + ad + "★ 4.8" (yolcunun verdiği)
   - Araç: "Ford Transit • 34 ABC 123"
   - Yolcunun verdiği rating + yorum (varsa)
7. **Stats kartı:**
   - "Mesafe: 18.4 km"
   - "Süre: 32 dk"
   - "Ücret: ₺145 • Kapıda nakit"
8. **Aksiyonlar (alt):**
   - "Tekrar bu rotada yolculuk yap" primary (pickup/dropoff koord'ları ile Confirm'e push)
   - "Yardım al" secondary (Help/Support ekranına bu trip_id ile yönlenir)

**State'ler:**
- `loading`: skeleton kart
- `loaded`: full state
- `cancelled`: stats kartında "İptal nedeni: ..." gösterilir

---

### Ekran 16 — Edit Profile

**Amaç:** Yolcunun ad, foto, e-mail (opsiyonel), dil tercihini güncellemesi.

**Layout:**
1. **Top bar:**
   - Sol: `chevron-left` (Account'a geri)
   - Title: "Profilini düzenle"
   - Sağ: "Kaydet" text buton (accent, değişiklik yoksa disabled)
2. **Avatar bölgesi (center, üstten):**
   - Mevcut avatar 96×96 daire
   - Üzerinde küçük overlay icon `camera`
   - Tap → ActionSheet: "Galeri'den seç / Kameradan çek / Kaldır"
3. **Form (TextField'lar):**
   - "Ad soyad" (zorunlu, min 2 hane)
   - "E-posta" (opsiyonel, fatura/destek için)
   - "Telefon" (read-only, kilit ikonu — telefon değiştirme V2)
4. **Dil seçici card:**
   - "Dil" label
   - Pill toggle: "Türkçe" / "English" — aktif olan accent border, diğer textMuted
   - Tap → anında çevir (i18next.changeLanguage)
5. **Tehlikeli bölge (alt, kırmızı border):**
   - "Hesabımı sil" danger ghost button (V2 — şimdilik confirm modal "Bu özellik şu an kullanılamıyor")

**State'ler:**
- `dirty`: "Kaydet" aktif
- `saving`: yukarıda spinner
- `saved`: toast "Profilin güncellendi"
- `avatar_uploading`: avatar üstünde spinner overlay

---

### Ekran 17 — Notifications

**Amaç:** Tüm push bildirimlerinin geçmişi + okunmamış sayısı.

**Layout:**
1. **Top bar:**
   - Sol: `chevron-left` (Home'a geri)
   - Title: "Bildirimler"
   - Sağ: "Tümünü okundu yap" text buton (varsa unread)
2. **Liste:**
   - Her kart (radius 16, padding 14, bgElevated):
     - Sol: 36×36 dairesel ikon (event type'a göre renk):
       - `ride_assigned` → mavi mesh + 🚗 ikon
       - `ride_arrived` → yeşil success + 📍 ikon
       - `ride_completed` → turuncu accent + ✓ ikon
       - `ride_cancelled` → kırmızı danger + ✕ ikon
       - `general` → lavender + 🔔 ikon
     - Orta: title (semibold) + body (sm muted, 2 satır truncate)
     - Sağ: tarih sm muted ("dün", "2 sa", "23 Mart")
     - Unread işareti: solunda 4px dikey turuncu accent bar
   - Tap kart → markRead + deep-link (ride detail'e veya home'a)
3. **Empty state:**
   - "Henüz bildirim yok" + bell ikonu büyük outline + "Yolculuk başlattığında buraya düşer"

**State'ler:**
- `loading`: skeleton
- `empty`: empty illustration
- `loaded`: kart listesi
- `pagination`: V2 infinite scroll

---

### Ekran 18 — Help/Support

**Amaç:** Yolcu yardım istediğinde SSS + iletişim formu.

**Layout (scrollable):**
1. **Top bar:**
   - Sol: `chevron-left`
   - Title: "Yardım"
2. **Hero card (üst):**
   - "Nasıl yardım edebiliriz?" (lg semibold)
   - "Sorularına 24 saat içinde dönüş yaparız." (sm muted)
3. **SSS accordion (3-5 madde):**
   - "Şoförüm gelmedi, ne yapmalıyım?"
   - "Ücret yanlış mı?"
   - "Eşyamı arabada unuttum"
   - "Hesabımı silmek istiyorum"
   - "Telefon numaramı değiştirmek istiyorum"
   - Tap → expand, içerik göster
4. **İletişim formu:**
   - Subject dropdown: "Genel / Yolculuk şikayeti / Ödeme / Diğer"
   - Yolculuk seç (opsiyonel, son 10 trip): "Hangi yolculuk?" dropdown veya null
   - Mesaj textarea (multiline 4 satır), placeholder "Sorununu yaz..."
   - "Gönder" primary
5. **Direkt iletişim (alt):**
   - "Acil mi? Hemen ara: 0850 XXX XX XX" sm muted link

**State'ler:**
- `idle`: form boş
- `submitting`: CTA loading
- `submitted`: toast "Mesajın iletildi 📩", form clear

---

## 8. Push notifications (eksiksiz v1.0'a dahil — zorunlu)

Yolcu SMS sadece signup'ta alır; ondan sonra **tüm uygulama içi iletişim push notification** üzerinden olur. Tasarımda push notification'ın hem **sistem bildirim alanında** hem de **app içinde Notifications ekranında** kayıt bırakması beklenir.

### Yolcu tarafı push event'leri

| Event | Tetikleyici | Title | Body örneği | Deep-link |
|---|---|---|---|---|
| `ride_searching_started` | yolcu "Çağır" basınca | "Şoför aranıyor" | "En yakın araç bulunuyor..." | `/(app)/ride/searching/{id}` |
| `ride_assigned` | bir şoför kabul edince | "Şoförün yolda 🚗" | "Ahmet Y. • 3 dk uzakta" | `/(app)/ride/active/{id}` |
| `ride_driver_arrived` | şoför pickup'a varınca | "Şoförün geldi 📍" | "Ford Transit • 34 ABC 123" | `/(app)/ride/active/{id}` |
| `ride_started` | şoför "İşi başlat" basınca | "Yolculuk başladı" | "Bağdat → Havalimanı" | `/(app)/ride/active/{id}` |
| `ride_completed` | şoför "İşi bitir" basınca | "Yolculuğun tamamlandı ✓" | "₺145 • Kapıda nakit • Değerlendir →" | `/(app)/ride/complete/{id}` |
| `ride_cancelled_by_driver` | şoför iptal eder | "Şoför iptal etti" | "Yeni şoför arıyoruz..." | `/(app)/ride/searching/{id}` |
| `ride_no_drivers` | matching timeout | "Şu an müsait şoför yok" | "Birazdan tekrar dene" | `/(app)/` |
| `payment_reminder` | completed 5dk sonra (opsiyonel) | "Ödeme hatırlatması" | "₺145 nakit ödemeyi unutma" | `/(app)/history/{id}` |
| `rating_reminder` | completed 1sa sonra, rating skip edildiyse | "Şoförü değerlendir" | "1 dakikanı al, deneyimini paylaş" | `/(app)/ride/rating/{id}` |

### Push permission akışı

- İlk Phone Auth'tan sonra (Profile Setup ardından Home'a ilk girişte) sistem permission prompt'u tetiklenir
- Reddedilirse: Account → Notifications altında "Bildirimleri aç" CTA kartı (sistem ayarlarına derin link)
- Token registration → `customers.push_token` + `push_platform` ('fcm' / 'apns') save

### App içi bildirim

- Tüm push'lar aynı zamanda `notifications` tablosuna yazılır (fleet'in mevcut tablosu reuse; ride event'leri için `type` enum genişler)
- Notifications ekranında geçmiş + okunmamış sayısı + Home'daki çan ikonunda badge

---

## 9. Out of scope (V2+ — bu brief'in dışı)

- **Kart ödeme** (iyzico 3DS) — kart ekleme + saklama
- **In-app cüzdan** (bakiye yükle, otomatik düş)
- **Scheduled ride** (ileri tarihli rezervasyon)
- **Multi-stop** (ara duraklar)
- **Surge pricing** (zaman + yoğunluk çarpanı)
- **Promo code / referral** (kupon, davet et kazanç)
- **In-app chat** şoför ↔ yolcu (KVKK + proxy mask gerekir)
- **Female-only driver tercihi**
- **Multi-city** (Ankara, İzmir genişlemesi)
- **B2B kurumsal hesap**
- **Hesap silme self-service** (KVKK ihlali değil ama formla yapılır şimdilik)

---

## 9. Çıktı beklenen format

Tasarımcıdan beklenen:
1. **Figma frame'leri** veya **PNG mockup**'lar — her ekran için iPhone 14 (390×844)
2. **Dark mode only** (light mode YOK — bu uygulama dark-first)
3. **Tüm state'ler** (idle / loading / error / success) ayrı frame'lerde
4. **Komponent library** — Button (primary/secondary/ghost), TextField (idle/focus/error), Card, Toast, Confirm Modal, Bottom Sheet, Bottom Nav

İsteğe bağlı:
- **Animasyon kareleri** (Searching pulse, Welcome mesh fade, CTA pressed)
- **Lottie JSON** (success check, loading bar)

---

## 10. Referans malzeme

- DriverMesh fleet app'in mevcut görselleri: `C:\Projeler\drivermesh\screenshots\` (varsa kullanıcıdan alınmalı)
- Mevcut welcome ekranı: `apps/ride/app/(auth)/welcome.tsx` (placeholder)
- Theme tokens: `packages/shared/src/theme/`
- Fleet komponent stilleri: `C:\Projeler\drivermesh\src\components\` (Screen, Button, TextField, MeshBackground, Logo, vb.)

---

*DriverMesh Ride UI/UX Tasarım Brief'i v0.1 — 2026-05-14*
*Bu brief Claude Design veya benzer bir tasarım aracına verilebilir. Mockup üretildikten sonra React Native + Expo Router implementasyonu yapılacak.*
