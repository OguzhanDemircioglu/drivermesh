# Başlarken — Yeni Filo Kurma

DriverMesh ile filonu yönetmeye başlamak için 3 adım var: kayıt, ekip davet, araç ekleme.

## Kayıt (Filo Başlat)

1. Welcome ekranında **"Filo Başlat"** butonuna dokun
2. Filo adı, kendi ad-soyad, e-posta ve şifre gir
3. E-posta doğrulama gelir, link'i tıkla
4. İlk girişte sen otomatik olarak **owner** (filo sahibi) olursun

> Owner tüm yetkilere sahiptir: araç ekleme, iş oluşturma, ekip davet, raporlama, bakım onayı, ride ayarları.

## Ana Sayfa (Home)

Giriş sonrası ana sayfada şunları görürsün:
- **Başlık bölümü:** Avatar + "Günaydın, {ad}" + bildirim ikonu + AI Asistan kısayolu
- **Status pill:** Mevcut durumun (Aktif / Mola / Mesai Dışı)
- **CANLI şerit:** "Filo Haritasını Görüntüle" — tüm araçların canlı konumu
- **Filo Ritmi kartı:** kaç araç aktif/idle/bakım dağılımı + bugünkü işler özet
- **Hızlı Aksiyon:** 4 düğme — Yeni İş, Kişi Ekle, Araç Ekle, Raporlar
- **Bugünkü İşler:** günün işleri kartlar halinde

## Bottom Nav

Alt navigasyonda 4 sekme:
- **Ana** — home dashboard
- **İşler** — iş listesi (assigned, in_progress, completed)
- **Filo** — araç listesi
- **Hesap** — profil + ayarlar + destek

## Sonraki Adımlar

Filonu kurmak için sırasıyla:
1. **Ekip davet et** — yönetici ve şoförleri davet kodu ile ekle ([04-ekip-davet.md](./04-ekip-davet.md))
2. **Araçları ekle** — plaka, marka, model, foto ([02-arac-yonetimi.md](./02-arac-yonetimi.md))
3. **İlk işi oluştur** — pickup/dropoff, şoför ata ([03-is-yonetimi.md](./03-is-yonetimi.md))

## Demo Modu

Welcome ekranında **"Demo App"** butonu var. Demo modunda 5 araç + 6 kişilik bir test filosu seninle paylaşılır, gerçek backend'e bağlanmadan tüm akışı denersin. AI asistanı sana adım adım her ekranı tanıtır.

> Demo'da yaptığın değişiklikler sadece senin cihazında kalır, başkasına gitmez.
