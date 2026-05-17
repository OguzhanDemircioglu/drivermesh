# Ride Entegrasyonu — Müşteri Çağırma Akışı

DriverMesh Fleet, DriverMesh Ride (müşteri uygulaması) ile entegre çalışır. Müşteri ride app'ten araç çağırır, fleet'teki driver kabul eder.

## Genel Akış

```
Müşteri (Ride App)              Driver (Fleet App)
       │                                │
       ▼                                │
"Araç Çağır" tap                        │
       │                                │
       ▼                                │
ride_search_vehicles                    │
(uygun şoför+araç listesi)              │
       │                                │
       ▼                                │
Spesifik araç seç                       │
       │                                │
       ▼                                │
request_ride (assigned)                 │
       │ ───── push notify ─────────────►
       │                                ▼
       │                        Yeni Yolculuk
       │                        bildirimi banner
       │                                │
       │                                ▼
       │                        Driver bildirimi açar
       │                        → driver-ride ekranı
       │                                │
       ▼                                ▼
       Aktif yolculuk takibi
       (her iki tarafta da)
```

## Ride App'ten Görünmek (Driver tarafı ayarları)

Filondaki araç müşteri tarafından çağrılabilir hale gelmesi için:

### 1. Fleet visibility
**Hesap > Ride Ayarları** ekranında:
- **Ride'a açıkken** toggle (`fleets_visibility.ride_enabled = true`)
- **Hizmet alanı** (service area) — harita üzerinde HQ merkezli daire (varsayılan 30 km buffer)
- **Mesai saatleri** (operating_hours) — günler + saatler (NULL ise 7/24)

### 2. Driver hazırlığı
Driver müşteri tarafından eşleşmek için:
- Profile.status = `'active'` olmalı (mola/mesai dışı değil)
- Üzerinde bir araç olmalı (`current_user_id`)
- Araç `status = 'idle'`, bakımda değil
- Driver aktif başka bir ride'da olmamalı

### 3. ride_search_vehicles filtreleri

Backend müşteriye sadece şu kriterleri sağlayan araçları gösterir:

- `vehicle.status = 'idle'`
- `vehicle.current_user_id IS NOT NULL` (driver atanmış)
- `vehicle.maintenance_started_at IS NULL` (bakımda değil)
- `vehicle.fleets_visibility.ride_enabled = true`
- `is_fleet_open(org_id, NOW())` — mesai içinde
- Driver `profile.status = 'active'`
- Driver `role = 'driver'`
- Driver aktif ride'da DEĞİL
- Müşteri pickup konumu service_area içinde

## Driver Yolculuk Akışı

Müşteri çağırınca driver fleet app'te:

### Yolculuk alındı bildirimi

1. Banner notification (foreground'da) veya push (background'da)
2. Tap → `app/(app)/driver-ride.tsx` ekranına yönlendir
3. Ekranda:
   - Müşteri adı + foto (varsa)
   - Pickup adresi + harita pin
   - Tahmini km + dakika
   - **"Müşteriye Yaklaşıyor"** butonu

### Driver akışı

| Adım | Buton | RPC | Status |
|---|---|---|---|
| Pickup'a yaklaşıyor | **"Geldim"** | `driver_arrived` | `driver_arrived` |
| Müşteri arabaya bindi | **"Yolculuğa Başla"** | `start_ride` | `in_progress` |
| Bırakış adresine vardı | **"Tamamla"** | `complete_ride` | `completed` |

### Yolculuk tamamlandıktan sonra

1. Driver'a rating modal'ı açılır: 1-5 yıldız + opsiyonel yorum
2. **"Müşteriyi Puanla"** → `submit_driver_rating` RPC
3. Modal kapanır, driver-ride ekranı sıfırlanır
4. Müşteri tarafında da rating modal'ı açılır (foreground transition + AppState listener)

## Aktif Yolculuk Banner

Driver bir ride aktifken fleet ana sayfada banner görünür:
- Üst kısımda turuncu border'lı kart
- "Aktif yolculuk var" + "Müşteriye dön"
- Tap → driver-ride ekranına geri dön

## Ride Source Job

Müşteri ride'ı kabul edilince fleet tarafında `jobs` tablosuna otomatik bir kayıt eklenir:
- `source = 'ride'` (internal/driver_request'ten farklı)
- `ride_request_id` ile ride_requests'e bağlı
- Driver job listesinde de görünür ("İşler" sekmesinde)

## V0.1 Limitleri

- Realtime channel V1'de yok — polling 3sn (`useActiveRide` hook)
- ETA live update V2'de gelir
- Müşteri ↔ driver mesajlaşma V2 (şu an telefon/arama yok)
- Cancel grace period UI V2
