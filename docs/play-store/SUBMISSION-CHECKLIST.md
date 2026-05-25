# Play Console — Submission Checklist & Form Cevapları

Bu döküman, DriverMesh Fleet (`com.drivermesh.android`) ve DriverMesh Ride (`com.drivermesh.ride`) uygulamalarını Google Play Console'a Internal Testing → Production sürecinde doldurman gereken **tüm formları** ve **hazır cevap metinlerini** içerir. Her bölümü açıp kopyalayıp Play Console'daki ilgili alana yapıştırabilirsin.

---

## 0) Hızlı URL'ler

- **Privacy Policy URL** (Play Console "App content → Privacy policy"):
  ```
  https://www.drivermesh.com/privacy.html
  ```
- **Terms of Service URL** (opsiyonel, store listing açıklamasında link verebilirsin):
  ```
  https://www.drivermesh.com/terms.html
  ```
- **Web site URL** (store listing → developer contact):
  ```
  https://www.drivermesh.com
  ```
- **Support email**:
  ```
  oguzhanturgut611@gmail.com
  ```

---

## 1) App Access (Test Hesabı)

Play reviewer SMS OTP doğrulamayla giriş yapamaz; **test phone+OTP** Supabase Dashboard'da tanımlı olmalı (Auth → Providers → Phone → "Test phone numbers and OTPs"). Test mode'da OTP gerçek SMS göndermeden kabul edilir.

**Play Console → App content → App access** → "All or some functionality is restricted" seç → "Add new instructions"

### Fleet (DriverMesh Fleet)

**Username/Phone**:
```
+905527735994
```

**Password/Other info**:
```
OTP test code: 123456
Test mode aktif (Supabase Auth Phone provider, geliştirme).

Adımlar:
1. Uygulamayı aç (welcome ekranı atlanır, direkt phone screen)
2. Ülke seçici varsayılan Türkiye (🇹🇷 +90), aynen bırak
3. Cep telefonu alanına: 5527735994 (E.164: +905527735994)
4. "Giriş Yap" butonuna bas
5. SMS gönderildi simülasyonu — gerçek SMS gelmez (test mode)
6. Verify-OTP ekranında: 123456 gir
7. Profile setup'a yönlendirilirsin (ad-soyad gir, devam et)
8. Ana ekran açılır → "Filo Başlat" ile demo akışı görebilirsin

Demo akışı: Welcome ekranında "Demo App" satırına tıklayarak gerçek
kullanıcı verisi olmadan tüm Patron + Yönetici + Şoför ekranlarını
gezebilirsin (sahte filo verisi, anında).

Filo Haritası: ana ekranda "Filo Haritasını Görüntüle" → Google Maps
+ Sultanahmet bölgesinde HQ + araç marker'ları görünür.
```

### Ride (DriverMesh Ride)

**Username/Phone**:
```
+905527735994
```

**Password/Other info**:
```
OTP test code: 123456
Test mode aktif (Supabase Auth Phone provider).

Adımlar:
1. Uygulamayı aç (welcome ekranı yok, direkt phone screen)
2. Ülke seçici varsayılan Türkiye (🇹🇷 +90)
3. Cep telefonu: 5527735994
4. "Giriş Yap" butonuna bas
5. Verify-OTP ekranında: 123456 gir
6. İlk girişte profile setup (ad-soyad)
7. Ana ekran → "İstanbul" şehrinde müsait araç araması

Yolcu uygulamasında SMS sadece ilk girişte istenir; sonraki açılışlarda
session AsyncStorage'da kalıcı, otomatik ana ekran.
```

---

## 2) Privacy Policy (App content → Privacy policy)

Sadece URL gir:
```
https://www.drivermesh.com/privacy.html
```

---

## 3) Ads (App content → Ads)

**Soru**: "Does your app contain ads?"
**Cevap**: **No**

---

## 4) Content rating (App content → Content rating)

IARC questionnaire — DriverMesh ride-hailing/fleet management, içerik kategorileri:

| Soru | Cevap |
|------|-------|
| Email address | oguzhanturgut611@gmail.com |
| Category | **Reference, News, or Educational** (ride-hailing yok, en yakın "Utility / Productivity" varsa onu seç) |
| Violence | No |
| Sexual content | No |
| Profanity | No |
| Controlled substances (drugs/alcohol/tobacco) | No |
| Gambling | No |
| User interaction (chat with strangers) | **Yes** — sürücü ile yolcu arasında mesajlaşma var (ride app, filo işi notları için fleet app) |
| Shares user location | **Yes** — eşleştirme için sürücüye yolcunun konumu paylaşılır |
| Personal info shared with other users | **Yes** — sürücü adı + araç plakası yolcuya gösterilir |
| Allows users to interact online | **Yes** — telefon araması (sürücü ↔ yolcu) |
| User-generated content | **No** (fotoğraflar sadece filo iç kullanım, public feed yok) |
| Digital purchases | No |
| Loot boxes / Real money gambling | No |

**Beklenen rating**: PEGI 3 / Everyone (kullanıcı etkileşim notu nedeniyle ESRB 12+ veya 13+ olabilir, bu OK)

---

## 5) Target audience and content (App content → Target audience)

**Target age**: **18+**
(DriverMesh sürücü/operatör tarafı yetişkin iş ortamı; yolcu tarafı ehliyet yaşı gerekmez ama Vonage SMS ve KVKK için 16+ pratiği)

**Family Program**: **No** (Designed for Families opt-out)

**Appeal to children under 13**: **No**
(Yolcu tarafı çocuk pazarı değil; UI yetişkin oryantasyonlu)

---

## 6) Data Safety (App content → Data safety)

En uzun adım. **Sırayla cevaplar**:

### 6.1 Data collection and security

| Soru | Cevap |
|------|-------|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected encrypted in transit? | **Yes** (TLS 1.2+) |
| Do you provide a way for users to request that their data is deleted? | **Yes** — in-app "Hesap → Hesabımı sil" |

### 6.2 Data types — Fleet (DriverMesh Fleet)

| Category | Collected? | Shared? | Purpose | Optional |
|----------|-----------|---------|---------|----------|
| **Personal info — Name** | ✅ Collected | ❌ Not shared | Account management, App functionality | Required |
| **Personal info — Email** | ✅ Collected | ❌ Not shared | Account management | Optional |
| **Personal info — Phone number** | ✅ Collected | ✅ Shared (Vonage for OTP only) | Account management, App functionality | Required |
| **Personal info — Other** (Şirket adı, rol) | ✅ Collected | ❌ Not shared | App functionality | Required |
| **Photos and videos — Photos** | ✅ Collected | ❌ Not shared (Cloudinary CDN'de host) | App functionality (araç + bakım fotoğrafı) | Optional |
| **Location — Approximate location** | ❌ | ❌ | — | — |
| **Location — Precise location** | ✅ Collected | ❌ Not shared (Supabase'de saklı) | App functionality (filo haritası, sürücü rotalama) | Required (uygulama aktifken) |
| **App info and performance — Crash logs** | ✅ Collected | ✅ Shared (Sentry) | Analytics (crash diagnostics) | Required |
| **App info and performance — Diagnostics** | ✅ Collected | ✅ Shared (Sentry) | Analytics | Required |
| **Device or other IDs** | ✅ Collected (FCM push token) | ✅ Shared (Firebase) | Notifications | Required |

### 6.3 Data types — Ride (DriverMesh Ride)

| Category | Collected? | Shared? | Purpose | Optional |
|----------|-----------|---------|---------|----------|
| **Personal info — Name** | ✅ Collected | ❌ Not shared | Account management, App functionality | Required |
| **Personal info — Phone number** | ✅ Collected | ✅ Shared (Vonage for OTP only) | Account management, App functionality | Required |
| **Location — Precise location** | ✅ Collected | ✅ Shared (driver via app for matching) | App functionality (sürücü çağırma) | Required (yolculuk sırasında) |
| **Device or other IDs** | ✅ Collected (FCM push token) | ✅ Shared (Firebase) | Notifications | Required |

**Not**: Ride'da Sentry yok (kapatıldı), crash logs collection yok.

### 6.4 Security practices (her iki app için aynı)

- ✅ Data is encrypted in transit (TLS 1.2+)
- ✅ You can request that data be deleted (in-app account deletion)
- ✅ Data deletion: 30-day soft-delete then permanent erasure
- ✅ Independent security review: No (henüz yok; sonradan eklenebilir)

---

## 7) News apps (App content → News apps)

**Soru**: "Is this a news app?"
**Cevap**: **No**

---

## 8) COVID-19 contact tracing (App content → COVID-19 contact tracing)

**Soru**: "Does this app use COVID-19 contact tracing or status?"
**Cevap**: **No**

---

## 9) Government apps (App content → Government apps)

**Soru**: "Was this app created by a government?"
**Cevap**: **No**

---

## 10) Financial features (App content → Financial features)

**Soru**: "Does this app provide financial features?"
**Cevap**: **No** (ödeme kabul / kredi / kripto vb. yok)

---

## 11) Government identity verification (App content)

Eğer Play Console sorarsa:
**Cevap**: **No** (kimlik doğrulama yapmıyoruz, sadece telefon OTP)

---

## 12) Store Listing

### Main store listing

**App name** (50 char limit):
- Fleet: `DriverMesh Fleet — Filo yönetimi`
- Ride: `DriverMesh Ride — Şoför çağır`

**Short description** (80 char limit):
- Fleet: `Filo sahibi, yönetici ve şoför için tek mobil platform. İş atama, harita.`
- Ride: `Telefon doğrulama ile hızlı şoför çağır. Türkiye'de DriverMesh ekosistemi.`

**Full description** (4000 char limit):

#### Fleet
```
DriverMesh Fleet — küçük ve orta ölçekli filo operasyonları için tasarlanmış mobil uygulama.

🚛 Filo yönetimi
• Araç envanteri: plaka, marka, model, fotoğraf
• Sürücü ataması ve devir-teslim
• Bakım talebi onayı ve takibi

🗺️ Canlı filo haritası
• Tüm aktif araçları gerçek zamanlı haritada gör
• Pickup/dropoff rotalarını izle
• HQ merkezli operasyon görünümü

📋 İş yönetimi
• Yeni iş oluştur, şoföre ata
• İş durumu: atandı → başladı → tamamlandı / iptal
• Müşteri bilgisi ve adres detayları

👥 Ekip yönetimi
• Patron / Yönetici / Şoför rolleri
• Yetkilendirme ve izin yönetimi
• Davet linki ile yeni üye ekleme

🌍 Türkçe + İngilizce dil desteği

🔐 Gizlilik & güvenlik
• KVKK + GDPR uyumlu (https://www.drivermesh.com/privacy.html)
• Telefon OTP doğrulaması
• Sunucu tarafı Row Level Security (RLS)
• TLS 1.2+ şifreli iletişim

📞 Destek
• E-posta: oguzhanturgut611@gmail.com
• Web: https://www.drivermesh.com

Yolcu çağrılarını kabul etmek için ayrıca "DriverMesh Ride" uygulamasını da kullanabilirsin.
```

#### Ride
```
DriverMesh Ride — Türkiye için yolcu çağırma uygulaması.

🚖 Hızlı şoför çağır
• Telefon numarası ile saniyeler içinde giriş
• Mevcut şehrindeki müsait araçları gör
• Tek dokunuşla araç çağır

📍 Konum tabanlı eşleştirme
• Yakındaki şoförleri otomatik bul
• Tahmini varış süresi
• Sürücü konumunu canlı izle

🛡️ Güvenli
• Telefon OTP doğrulama (Vonage SMS)
• Sürücü kimlik bilgileri görünür (ad, araç plakası)
• Yolculuk geçmişi kayıtlı

🌍 Türkçe + İngilizce arayüz

⚡ Hızlı
• Welcome ekranı yok — direkt phone'a aç
• Ülke seçici 240+ ülke
• İlk girişten sonra otomatik login (SMS yok)

🔐 KVKK + GDPR uyumlu
https://www.drivermesh.com/privacy.html

📞 Destek
• E-posta: oguzhanturgut611@gmail.com
• Web: https://www.drivermesh.com

DriverMesh ekosisteminin yolcu tarafı. Filo sahipleri için ayrı uygulama: "DriverMesh Fleet".
```

### Graphics

- **App icon** (zorunlu): 512×512 PNG, transparent dışı (assets/icon.png mevcut — telefon screenshotunda doğrulandı)
- **Feature graphic** (zorunlu): 1024×500 JPG/PNG (üret veya assets/'taki splash görselinden crop)
- **Screenshots** (zorunlu, minimum 2): Telefonda ride / fleet'ten alınan screenshot'lar. Çözünürlük: en az 320 px kısa kenar, en fazla 3840 px.

**Hızlı screenshot rehberi**:
```
adb -s 8439255f exec-out screencap -p > screenshots/fleet-home.png
adb -s 8439255f exec-out screencap -p > screenshots/fleet-map.png
adb -s 8439255f exec-out screencap -p > screenshots/ride-home.png
adb -s 8439255f exec-out screencap -p > screenshots/ride-phone.png
```

---

## 13) Categorization (App content → App category)

| App | Category |
|-----|----------|
| Fleet | **Business** |
| Ride | **Maps & Navigation** (veya Travel & Local) |

**Tags** (Play Console önerir): fleet, logistics, dispatch, business, navigation, transportation, ride

---

## 14) Pricing & distribution

- **Country**: Türkiye (önce) → onaylanırsa diğer ülkeler
- **Free**: Yes
- **In-app purchases**: No
- **Designed for Families**: No
- **Contains ads**: No

---

## 15) Final Submit for Review

Tüm bölümler ✓ olduğunda **Internal testing** track'inde:

1. Sol menü **Internal testing** → mevcut DRAFT release'i aç
2. **Review** sayfasında tüm form uyarılarının yeşil olması gerekir
3. **Start rollout to Internal testing** butonuna bas
4. Email'inde "review başladı" bildirimi
5. Google reviewer 1-3 iş günü içinde değerlendirir
6. Onaylanırsa: Internal testers (sen + eklediğin email'ler) Play Store'da uygulamayı indirebilir

---

## 16) Post-launch — Açık olarak kalan kullanıcı eylemleri

- [ ] Firebase Console → Maps API key (`AIzaSyCne...` + `AIzaSyALSA...`) package + SHA-1 restriction
- [ ] Google Cloud Console → Maps API billing (varsa quota kontrolü)
- [ ] Supabase Dashboard → Auth → Providers → Phone → "SMS Message" Türkçeleştir: `DriverMesh giriş kodun: {{ .Code }}`
- [ ] Vonage Dashboard → Sender IDs → `DRIVERMESH` başvurusu (BTK approval 1-2 hafta)
- [ ] Production öncesi: Supabase test phone OTP list'i temizle (gerçek SMS akışına geç)
- [ ] Sentry production source map upload — DSN/token sentry.io'da doğrula, eas.json'dan `SENTRY_DISABLE_AUTO_UPLOAD: true` kaldır
- [ ] Privacy Policy "Demo Lojistik AŞ" → gerçek şirket adı veya şahıs kaydı bilgileri ile değiştir
- [ ] Play Console → App signing key → güvenli yedek al

---

**Doküman tarihi**: 2026-05-22
