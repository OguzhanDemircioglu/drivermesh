# İş Yönetimi

DriverMesh'te bir "iş" (job), bir müşteri için pickup → dropoff arasında yapılan taşıma işlemidir.

## İş Oluşturma

1. Bottom nav **İşler** → sağ üstte **"+"** (veya Hızlı Aksiyon'dan **Yeni İş**)
2. Form alanları:
   - **Müşteri adı** (zorunlu)
   - **Alış adresi** + harita pin (zorunlu)
   - **Bırakış adresi** + harita pin (opsiyonel — ride flow'da müşteri sözlü verir)
   - **Tahmini mesafe** (km, auto-hesaplanır)
   - **Tahmini süre** (dakika, auto-hesaplanır)
   - **Şoför ataması** (opsiyonel — sonra atayabilirsin)
   - **Notlar**
3. **Kaydet** → `status = 'created'` veya `'assigned'` (driver atadıysan)

> Sadece `owner` ve `manager` iş oluşturabilir (default). Driver'a izin verirsen, kendi araçları için ride flow'la self-request yapar.

## İş Durumları (Status)

| Status | Anlam |
|---|---|
| `created` | Henüz şoför atanmamış |
| `assigned` | Şoföre atandı, henüz başlamadı |
| `in_progress` | Şoför başlattı, devam ediyor |
| `completed` | Tamamlandı |
| `failed` | Şoför veya backend başarısız işaretledi (örn. müşteri bulunamadı) |
| `cancelled` | Müşteri veya yönetici iptal etti |

## İş Atama

1. İş listesinde işi tap → detay
2. **"Şoför Ata"** veya kalem ikonu → düzenleme
3. Şoför seç + araç seç (şoförün üzerindeki araçlardan)
4. **Kaydet** → şoföre push notification gider

## İş Akışı (Driver tarafı)

1. Driver "İşler" sekmesinde `assigned` durumdaki işleri görür
2. İşi tap → detay + alış-bırakış haritası + mini map
3. **"Başla"** → status `in_progress`, started_at set, harita rotası açılır
4. Apple Maps / Google Maps yönlendirmeyi açar (`openInMaps.ts`)
5. Driver pickup'a varır, müşteriyi alır
6. Dropoff'a varır → **"Tamamla"** → status `completed`, completed_at set
7. Tamamlandıktan sonra varsa müşteri rating modal'ı açılır

## İş İptali

1. Owner/manager iş detayında **"İptal"** butonu
2. Onay → status `cancelled`, varsa atanan driver bildirim alır

## İş Düzenleme

`created`, `assigned`, `in_progress` durumundaki işler düzenlenebilir:
- Pickup/dropoff adresi
- Müşteri adı
- Notlar

`completed`, `failed`, `cancelled` işler readonly.

## Filo Haritası

Ana sayfada **"Filo Haritasını Görüntüle"** şeridi → haritada:
- Aktif araçlar (yeşil pin)
- Bakımdaki araçlar (turuncu pin)
- Boşta araçlar (gri pin)
- HQ konumu (lacivert pin, Hesap > HQ'dan ayarlanır)

Pin'e tıklayınca araç + şoför + aktif iş özeti.

## Raporlar

Bottom nav'dan **Hesap > Raporlar** veya Hızlı Aksiyon'dan:
- Bugün biten iş sayısı
- Bu hafta / ay toplam km
- Şoför bazlı performans
- Araç kullanım oranı

> Driver kendi raporlarını görür (`reports.view` izni varsa). Owner/manager tüm filoyu görür.
