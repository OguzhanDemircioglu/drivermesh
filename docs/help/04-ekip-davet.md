# Ekip Yönetimi — Davet ve İzinler

DriverMesh'te 3 rol var: **owner** (1 kişi, filo sahibi), **manager** (N kişi, yönetici), **driver** (N kişi, şoför).

## Yetki Hiyerarşisi

```
Owner ──► Manager'lar ──► Driver'lar
```

- Owner manager'ı davet eder
- Manager driver'ı davet eder (veya owner direkt davet eder)
- Driver atanan bir manager'a bağlıdır (`profiles.manager_id`)

## Davet Akışı (Yönetici tarafı)

1. **Hesap > Ekip** sekmesine git
2. Sağ üstte **"Davet Et"** butonu
3. Form:
   - **Ad-Soyad** (zorunlu)
   - **E-posta** (zorunlu, davet linki buraya gider)
   - **Rol** — manager veya driver
   - **Manager** (driver için zorunlu) — hangi yönetici altında çalışacak
4. **Davet Gönder** → 32-karakter token üretilir, e-posta linki gönderilir

Davet 7 gün geçerlidir.

## Daveti Kabul Etme (Davet Edilen tarafı)

E-posta link'i veya manuel token girişi:

1. **Welcome ekranı** → "Davet Kodum Var" butonu
2. **Davet Kodu** + **E-posta** + **Şifre** belirle
3. **Kabul Et** → davet token doğrulanır, profile oluşturulur, kişi filoya katılır

## İzinler (Permissions)

Her rolün default izinleri var, owner override edebilir:

### Owner (default)
Tüm izinler açık.

### Manager (default)
- ✅ Araç görme, ekleme, güncelleme
- ❌ Araç silme
- ✅ İş görme, oluşturma, atama, güncelleme
- ❌ İş iptali (kritik)
- ✅ Ekip davet etme
- ❌ Ekip üyesi çıkarma (kritik)
- ✅ Raporları görüntüleme
- ✅ Bakıma alma + onay

### Driver (default)
- ✅ Araç görme
- ❌ Araç ekleme/güncelleme/silme
- ✅ İş görme
- ❌ İş oluşturma/atama/iptal
- ❌ Ekip yönetimi
- ❌ Raporlar
- ✅ Bakıma alma talebi açma
- ❌ Bakım onaylama

### İzin Override

1. **Hesap > Ekip** → kişi tap → İzinler ekranı
2. Her izin satırında toggle — default'tan farklı bir override koy
3. Critical izinler (silme, iptal, ekipten çıkarma) sarı uyarı ile işaretli
4. **Kaydet** → ilgili kişiye anlık bildirim gider

Override'lar `permission_grants` tablosunda saklanır, etkili izin = default ∨ override.

## Ekipten Çıkarma

1. **Ekip** → kişi tap → detay
2. Sağ üstte **çöp kutusu** ikonu (sadece owner)
3. İki adımlı onay
4. Çıkarılan kişi:
   - Profile silinir
   - Üzerindeki araçlar serbest bırakılır
   - Aktif işleri pending duruma döner (yeniden atanmalı)
   - Login yapamaz

## Bekleyen Davet

Henüz kabul edilmemiş davet için:
- **Ekip** sekmesinde "Bekleyen Davetler" bölümünde görünür
- Yanında badge sayısı: ana sayfada Hızlı Aksiyon "Kişi Ekle" altında nokta
- Davet süresi dolarsa otomatik silinir (7 gün)
- Manuel iptal: davet satırında "İptal" → token invalidate
