# Araç Yönetimi

Filondaki araçları ekleme, düzenleme, foto yükleme, bakıma alma ve sahiplenme akışları.

## Araç Ekleme

1. Bottom nav'da **Filo** sekmesine git (veya Hızlı Aksiyon'dan **Araç Ekle**)
2. Sağ üstte **"+"** butonuna dokun
3. Formu doldur:
   - **Plaka** (zorunlu) — örn. "34 ABC 123"
   - **Marka + Model** (zorunlu) — örn. "Ford Transit"
   - **Yıl** — opsiyonel
   - **Renk** — araç kartında badge olarak görünür
   - **Foto** (1-5 adet) — kamera veya galeriden
4. **Kaydet** → araç filonuza eklenir, status `idle` (boşta) olur

> İlk araç eklendiğinde otomatik olarak senin üzerine alınır (`current_user_id = owner.id`).

## Araç Düzenleme

1. **Filo** sekmesinde aracı tap → araç detay
2. Sağ üstte **kalem (✏️)** ikonu → düzenleme formu
3. Plaka dışındaki alanları güncelle (plaka değiştirme yeni araç olarak ekle)
4. Foto ekle/sil — multi-foto picker (max 5)
5. **Kaydet**

## Araç Sahiplenme — "Üzerine Al"

Bir araç idle durumdayken ve kimsenin üzerinde değilse, sen kendi üzerine alabilirsin (B2B internal claim).

1. Araç listesinde araç kartında **"Üzerine Al"** butonu görünür
2. Dokun → `claim_vehicle` RPC çağrılır
3. Kontroller:
   - Aracın `status = 'idle'`
   - `current_user_id IS NULL` (kimse üzerinde değil)
   - Bakımda değil (`maintenance_started_at IS NULL`)
4. Başarılıysa `current_user_id = senin user id'n` olur
5. Önceki üzerindeki araç (varsa) otomatik serbest bırakılır (`current_user_id = NULL`)

> Bir kişi aynı anda **birden fazla araç** üzerinde olabilir (örn. patron 3 araç sahibi). Ama bir araç aynı anda **tek bir kişinin** üzerindedir.

## Araç Bırakma (Release)

1. Senin üzerinde olan aracı tap
2. Detay ekranında **"Bırak"** butonu (sadece sahip görür)
3. Onay → `current_user_id = NULL` olur, araç boşta kalır

## Bakıma Alma

Aracın bakım talebi açma akışı:

1. Araç detayında **"Bakıma Al"** butonu (driver self-request veya manager/owner)
2. Form:
   - **Sebep** (zorunlu) — "Sol ön lastik değişimi", "Motor uyarı ışığı" gibi
   - **Tahmini süre** (dakika) — opsiyonel
   - **Foto** (1-5) — bakım gerekçesi kanıtı, EXIF kontrol edilir
3. **Talep Gönder** → `maintenance_requests` satırı `status = 'pending'`
4. Owner/manager mobile push bildirimi alır
5. Onay → araç `status = 'maintenance'`, `maintenance_until` set; Red → talep kapanır
6. Bakım bitince auto-checkout cron'u `maintenance_until` geçince aracı `idle`'a döndürür

### Authenticity check

Yüklenen bakım fotoları otomatik kontrol edilir:
- **EXIF metadata** — foto tarihi, kameran model, GPS (varsa)
- **AI suspect** — foto AI-generated mi (ML model)
- **İçerik sınıfı** — vehicle / non_vehicle (yanlış foto upload önlenir)

Patron paneli bu sinyalleri "AI suphesi", "EXIF eksik", "Yanlış içerik" badge'leriyle gösterir.

## Araç Silme

1. Araç detayında **çöp kutusu** ikonu (sadece owner görür)
2. İki adımlı onay (yanlış silme önlenir)
3. Silinen aracın işleri yetim kalır — önce işleri başka araca ata
