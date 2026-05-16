# Ride App — Araç Görünürlük, Şoför Sahiplenme ve Mesai Kuralları

**Tarih:** 2026-05-16
**Durum:** Spec — implementasyon bekliyor
**İlgili:** [2026-05-15-drivermeshride-architecture.md](2026-05-15-drivermeshride-architecture.md), [TESTING.md](../../TESTING.md)

---

## 0. Bağlam

E2E test sonucu (2026-05-16) gösterdi ki `ride_search_vehicles` mevcut hali ile her idle aracı müşteriye gösteriyor. Gerçek operasyonel kurallar daha sıkı:

- Araç müşteriye gösterilmek için **gerçek bir şoförün** üzerine alınmış (claim) olmalı.
- Şoför o anda **aktif** (mesai başında, molada/mesai dışı değil) olmalı.
- Filo **mesai saatleri** içinde olmalı.
- Araç **iş üstünde** ise başka şoför sahiplenememeli (lock).
- **Owner** dahil herkes kendi anlık çalışma durumunu (status) UI'dan değiştirebilmeli.

Bu döküman bu kuralların DB şeması, RPC kontratları, UI yüzeyi ve test kapsamını netleştirir.

---

## 1. Sahiplik modeli (vehicle ↔ profile)

### Mevcut durum
- `vehicles.current_user_id` (uuid, nullable, FK profiles)
- Araç eklendiğinde NULL kalabiliyor; UI'dan sonradan atanıyor.
- Tek aracın bir anda **bir kullanıcısı** olabilir (1:1 anlık ilişki).

### Yeni kurallar
1. **Default at create:** Yeni araç eklenirken `current_user_id = auth.uid()` (yani patron). NULL'a izin verilmez (NOT NULL constraint eklenebilir M1 sonrası).
2. **Claim:** Herhangi bir profile (aynı org) kendisini bir aracın üstüne alabilir → `claim_vehicle(p_vehicle_id)` RPC.
3. **Çoklu araç:** Bir şoför **birden fazla** aracın üstünde olabilir (limit yok). 1 araç → 1 kullanıcı kuralı korunur (FCFS), ama 1 kullanıcı → N araç serbest.
4. **Aktif ride kilidi:** Araç `ride_requests.status IN ('searching','assigned','driver_arrived','in_progress')` ile bağlı bir ride taşıyorsa, başka kullanıcı `claim_vehicle` çağıramaz. `T8: vehicle on active ride` hatası.
5. **Bakım kilidi:** `vehicles.maintenance_started_at IS NOT NULL` ise claim reddedilir (T9).
6. **Migration:** Mevcut `current_user_id IS NULL` satırları organizasyonun owner'ına set edilir (data backfill).

### State diyagramı (vehicle)

```
[create]  → current_user_id = owner
              │
              ├─ owner.claim_vehicle()       → no-op (zaten o)
              ├─ driver_A.claim_vehicle()    → driver_A (kilit yok)
              │       │
              │       ├─ ride başlar         → kilit AKTİF
              │       │       ├─ driver_B.claim → T8 reject
              │       │       └─ ride tamamlanır → kilit kalkar
              │       │
              │       └─ driver_B.claim       → driver_B (FCFS)
              │
              └─ maintenance_started_at set   → kilit AKTİF (T9)
```

---

## 2. Profile status (user availability)

### Yeni kolon — `profiles.status`

Enum tipi `user_availability_status`:

| Değer | Anlam | Manuel? | Ride'da görünür? |
|---|---|---|---|
| `active` | Mesaide, aktif çalışıyor | manuel | ✅ |
| `break` | Molada | manuel | ❌ |
| `off_duty` | Mesai dışı | manuel | ❌ |
| `on_trip` | Aktif ride'da (auto) | sistem | ❌ |
| `unavailable` | Müsait değil (kişisel sebep) | manuel | ❌ |

**Default:** Yeni profile için `off_duty` (mesai dışı). Owner ilk register'da `active` set edilebilir (ya da elle değiştirir).

**`status_updated_at`** (timestamptz): UI'da "son güncelleme: 5 dk önce" gösterimi için.

**Otomatik geçişler:**
- Şoföre ait bir araçta ride status `assigned` → şoför.status `on_trip` (trigger veya RPC içinde set)
- Ride status `completed` veya `cancelled_*` → şoför.status `active`'e geri döner (eğer öncesinde active idiyse — manuel break/off_duty'yi geri çekme).
- Owner için on_trip durumu otomatik tetiklenmez (owner ride'a çıkmaz varsayılır).

### Yeni RPC — `set_my_status(p_status)`

```sql
set_my_status(p_status user_availability_status) RETURNS user_availability_status
```

Kontroller:
- auth.uid() profile var olmalı.
- `on_trip` manuel set edilemez (T10 unauthorized status).
- Şoför `on_trip` iken manuel başka status'a geçemez (ride bittiğinde otomatik döner). Override istenirse `force_status` flag eklenebilir V2.

### Migration
```sql
CREATE TYPE user_availability_status AS ENUM
  ('active','break','off_duty','on_trip','unavailable');
ALTER TABLE profiles
  ADD COLUMN status user_availability_status NOT NULL DEFAULT 'off_duty',
  ADD COLUMN status_updated_at timestamptz NOT NULL DEFAULT now();
```

---

## 3. Mesai saatleri (operating hours)

### Mevcut durum
- `fleets_visibility.operating_hours` (jsonb, nullable) — şu an kullanılmıyor.

### Yeni format

```json
{
  "tz": "Europe/Istanbul",
  "mon": [{"start": "08:00", "end": "18:00"}],
  "tue": [{"start": "08:00", "end": "18:00"}],
  "wed": [{"start": "08:00", "end": "18:00"}],
  "thu": [{"start": "08:00", "end": "18:00"}],
  "fri": [{"start": "08:00", "end": "18:00"}],
  "sat": [{"start": "10:00", "end": "16:00"}],
  "sun": []
}
```

- `tz` zaman dilimi (IANA), filodaki çalışma saatleri lokal saatten yorumlanır.
- Her gün için **0..N aralık** (mola için ikiye bölünebilir).
- Boş array `[]` → o gün kapalı.
- `operating_hours IS NULL` → 7/24 açık (geriye dönük uyumluluk).

### Yeni helper — `is_fleet_open(p_org_id uuid, p_at timestamptz DEFAULT now())`

Postgres fonksiyonu boolean döner. `ride_search_vehicles` içinde her org satırına uygulanır.

---

## 4. `ride_search_vehicles` güncellenmiş kurallar

### Yeni WHERE clause (sıralı)

1. `fleets_visibility.ride_enabled = true`
2. `is_fleet_open(organization_id) = true`
3. `vehicles.current_user_id IS NOT NULL`
4. **Yeni:** `current_user.role = 'driver'` (owner üstünde olan araç ride'da görünmez)
5. **Yeni:** `current_user.status = 'active'` (mola/off_duty/on_trip/unavailable hariç)
6. `vehicles.maintenance_started_at IS NULL`
7. **Yeni:** Aktif ride yok — `NOT EXISTS (SELECT 1 FROM ride_requests WHERE vehicle_id = v.id AND status IN ('searching','assigned','driver_arrived','in_progress'))`
8. `ST_Contains(service_area, customer_point)` (mevcut)

### Beklenen UX
- Galata'da Test Lojistik'in aracı, Test Şoför `status='active'` ve aracı üstüne almışsa görünür.
- Test Şoför molaya geçtiğinde araç anında listeden düşer.
- Mesai bitince filo komple gizlenir.
- Şoför rideda iken araç görünmez (zaten on_trip + aktif ride var).

---

## 5. Fleet UI değişiklikleri

### A. Anasayfa status pill

`app/(app)/index.tsx` — TR/EN seçici hemen altına bir **status pill** + bottom-sheet seçici:

```
┌──────────────┐
│  🟢 Aktif ▾  │  ← dil seçici altında
└──────────────┘
```

Renkler:
- 🟢 active — yeşil
- 🟡 break — sarı
- ⚫ off_duty — gri
- 🔵 on_trip — mavi (disabled, manuel değişemez)
- 🔴 unavailable — kırmızı

Tıkla → bottom sheet "Durumumu değiştir" → 4 seçenek (on_trip hariç) → `set_my_status` RPC → UI invalidate.

### B. Vehicle list "Üzerine Al" butonu

`app/(app)/vehicles/index.tsx` ve detail: Eğer `current_user_id !== auth.uid()` ise **"Üzerine Al"** butonu. Tıkla → `claim_vehicle` RPC → success toast + invalidate. T8/T9 hatalarında toast.

### C. Vehicle kartında "Üzerinde" badge

Her araç kartında `current_user_id`'nin full_name'i görünür: "Üzerinde: Test Şoför". Tıklanabilir → driver detayına götürür (V2).

### D. Vehicle status counter güncelleme

Mevcut "0 aktif · 1 boşta" → yeni semantik:
- **aktif** = aktif ride'da (1+ ride_requests.status IN active states)
- **müsait** = şoför üstünde, status='active', kilit yok (yani ride'da görünür)
- **boşta** = şoför üstünde değil veya status != 'active' (owner üstünde dahil)
- **bakımda** = maintenance_started_at NOT NULL

UI: "1 aktif · 2 müsait · 3 boşta · 1 bakımda"

---

## 6. Ride app etkisi (müşteri)

- Vehicle list (`ride_search_vehicles`) yukarıdaki yeni filtrelerle çalışır. UI tarafında değişiklik gerekmez.
- Boş liste durumu için empty state mesajı eklenebilir: "Şu anda Galata'da müsait sürücü yok. Mesai 08:00–18:00 arası."

---

## 7. RPC kontratları (özet)

| RPC | Argümanlar | Return | Hata kodları |
|---|---|---|---|
| `claim_vehicle(p_vehicle_id)` | uuid | uuid (vehicle_id) | T8 (active ride), T9 (maintenance), T3 (org mismatch), T4 (profile missing) |
| `set_my_status(p_status)` | enum | enum (yeni status) | T10 (on_trip manuel set), T4 (profile missing) |
| `is_fleet_open(p_org_id, p_at?)` | uuid, ts | boolean | — |
| `ride_search_vehicles(p_lat, p_lng, p_radius_km)` | float, float, int | row set | (RPC reject yok, sadece filtreli row döner) |

---

## 8. Migration sırası

1. `CREATE TYPE user_availability_status` enum
2. `ALTER TABLE profiles ADD COLUMN status, status_updated_at`
3. Backfill: `UPDATE profiles SET status='off_duty'` (default zaten)
4. `vehicles.current_user_id` backfill: NULL olanlar → org owner'a set
5. (Opsiyonel) `ALTER TABLE vehicles ALTER COLUMN current_user_id SET NOT NULL`
6. RPC'leri yarat: `claim_vehicle`, `set_my_status`, `is_fleet_open`
7. `ride_search_vehicles` yeniden yarat (replace) yeni WHERE clause ile
8. Vehicle insert trigger: `BEFORE INSERT SET current_user_id = COALESCE(NEW.current_user_id, auth.uid())`
9. Ride state geçiş trigger: ride_requests UPDATE on status → ilgili driver_id'nin profile.status'unu sync

---

## 9. Geriye uyumluluk

- Mevcut `current_user_id IS NOT NULL` filtresi yeni `role='driver'` filtresi ile sıkılaşıyor; **owner üstündeki araçlar artık ride'da gizlenir**. Bu istenen yeni davranış.
- Mevcut tüm araçlar create'te owner'a atanmış değil; backfill ile düzeltilir.
- `operating_hours IS NULL` 7/24 açık — yeni filo eklenirken zorunlu hale getirilebilir (UI form ile).

---

## 10. Açık sorular (kullanıcı netleştirsin)

- **on_trip otomatik geçiş kapsamı:** şoför birden fazla araca claim'liyse, sadece active ride'lı aracın şoföründe on_trip mi yoksa hepsi mi? Önerilen: profile.status tek alan, ride aktifken on_trip → o şoförün **tüm araçları** ride listesinden düşer.
- **on_trip'ten dönüş:** ride bittiğinde otomatik `active`'e mi yoksa kullanıcının manuel başlattığı status'a mı (varsa `break`)? Önerilen: pre-trip status saklanır (`profiles.pre_trip_status`), trip sonu oraya döner.
- **Owner için status:** Owner aktif şoförlük yapmıyorsa pill onda da olsun mu? Önerilen: evet, herkes için tek tip UI; owner default `off_duty` (kendi durumu).
- **Mesai saati override:** Filo özel günlerde (resmi tatil) erken kapanırsa nasıl set edilecek? V2: `fleets_visibility.holiday_overrides` jsonb listesi.
- **Status değişimi gecikmesi:** Şoför mola dedikten kaç saniye sonra müşterinin listesinden düşmeli? Mevcut polling 3sn → 3-6sn gecikme. V2'de realtime channel.
