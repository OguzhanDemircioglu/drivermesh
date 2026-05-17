// Knowledge Base — markdown chunks inline embedded.
//
// V0.1 strateji: docs/help/*.md içerikleri build time bu dosyaya embed edilir.
// Edge function deploy edildiğinde KB tamamı bundle'a girer, runtime'da
// `searchKB` keyword RAG ile en alakalı top-k chunk'ı döner.
//
// V0.2'de embedding-based RAG (Supabase pgvector) gelir.

export interface KBChunk {
  source: string; // dosya adı (örn. "02-arac-yonetimi.md")
  heading: string; // chunk başlığı (## level)
  content: string; // chunk gövdesi
}

// Stop-word filter — yaygın TR/EN kelimeler skor hesabında atılır
const STOP_WORDS = new Set([
  've', 'veya', 'ile', 'için', 'ki', 'de', 'da', 'bir', 'bu', 'şu', 'ne', 'mi', 'mu',
  'the', 'a', 'an', 'of', 'and', 'or', 'is', 'are', 'was', 'were', 'be', 'to', 'in', 'on', 'at',
  'how', 'what', 'when', 'where', 'why', 'nasıl', 'nedir', 'nasil',
]);

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(s: string): string[] {
  return normalize(s)
    .split(' ')
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

/** Keyword-based scoring: query token'lar chunk'ta geçtikçe skor artar. */
function score(query: string, chunk: KBChunk): number {
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return 0;
  const text = normalize(chunk.heading + ' ' + chunk.content);
  let s = 0;
  for (const t of qTokens) {
    // Heading match'leri 2x ağırlık
    const inHeading = normalize(chunk.heading).includes(t);
    const inContent = text.includes(t);
    if (inHeading) s += 2;
    else if (inContent) s += 1;
  }
  return s / qTokens.length;
}

/** Top-k en alakalı chunk'ı döner. */
export function searchKB(kb: KBChunk[], query: string, k = 3): string[] {
  const ranked = kb
    .map((chunk) => ({ chunk, s: score(query, chunk) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, k);
  return ranked.map((r) => `# ${r.chunk.source} — ${r.chunk.heading}\n${r.chunk.content}`);
}

// ============================================================
// KB DATA — markdown içerikleri inline (deploy zamanı bundle'a girer)
// ============================================================

export const KB: KBChunk[] = [
  // -------- 01-baslarken.md --------
  {
    source: '01-baslarken.md',
    heading: 'Kayıt (Filo Başlat)',
    content: `Welcome ekranında "Filo Başlat" butonuna dokun. Filo adı, kendi ad-soyad, e-posta ve şifre gir. E-posta doğrulama linkini tıkla. İlk girişte sen otomatik olarak owner (filo sahibi) olursun. Owner tüm yetkilere sahiptir: araç ekleme, iş oluşturma, ekip davet, raporlama, bakım onayı, ride ayarları.`,
  },
  {
    source: '01-baslarken.md',
    heading: 'Ana Sayfa (Home)',
    content: `Giriş sonrası ana sayfada şunlar var: Avatar + "Günaydın, {ad}" + bildirim ikonu + AI Asistan kısayolu. Status pill (Aktif / Mola / Mesai Dışı). CANLI şerit "Filo Haritasını Görüntüle". Filo Ritmi kartı (kaç araç aktif/idle/bakım). Hızlı Aksiyon 4 düğme: Yeni İş, Kişi Ekle, Araç Ekle, Raporlar. Bugünkü İşler listesi.`,
  },
  {
    source: '01-baslarken.md',
    heading: 'Bottom Nav',
    content: `Alt navigasyon: Ana (home dashboard), İşler (iş listesi), Filo (araç listesi), Hesap (profil + ayarlar + destek).`,
  },
  {
    source: '01-baslarken.md',
    heading: 'Demo Modu',
    content: `Welcome ekranında "Demo App" butonu ile test bir filoyu denersin: 5 araç + 6 kişi, gerçek backend'e bağlanmadan tüm akış. AI asistanı sana adım adım her ekranı tanıtır. Demo'da yaptığın değişiklikler sadece senin cihazında kalır.`,
  },

  // -------- 02-arac-yonetimi.md --------
  {
    source: '02-arac-yonetimi.md',
    heading: 'Araç Ekleme',
    content: `Bottom nav Filo sekmesine git veya Hızlı Aksiyon Araç Ekle'ye dokun. Sağ üstte + butonu. Form: Plaka (örn. 34 ABC 123), Marka + Model (Ford Transit), Yıl, Renk, Foto (1-5 adet kamera veya galeri). Kaydet → araç filoya eklenir, status idle olur. İlk araç eklendiğinde otomatik olarak owner üzerine alınır.`,
  },
  {
    source: '02-arac-yonetimi.md',
    heading: 'Araç Sahiplenme — Üzerine Al',
    content: `Bir araç idle ve kimsenin üzerinde değilse "Üzerine Al" butonu görünür. Dokun → claim_vehicle RPC çağrılır. Kontroller: vehicle.status = idle, current_user_id IS NULL, maintenance_started_at IS NULL. Başarılıysa current_user_id = senin user id'n olur. Önceki üzerindeki araç (varsa) otomatik serbest bırakılır. Bir kişi aynı anda birden fazla araç üzerinde olabilir. Ama bir araç aynı anda tek bir kişinin üzerinde olur.`,
  },
  {
    source: '02-arac-yonetimi.md',
    heading: 'Araç Bırakma (Release)',
    content: `Senin üzerinde olan aracı tap → detay ekranında "Bırak" butonu (sadece sahip görür). Onay → current_user_id = NULL olur, araç boşta kalır.`,
  },
  {
    source: '02-arac-yonetimi.md',
    heading: 'Bakıma Alma',
    content: `Araç detayında "Bakıma Al" butonu (driver self-request veya manager/owner). Form: Sebep (zorunlu, örn "Sol ön lastik değişimi"), Tahmini süre (dakika), Foto 1-5 (EXIF kontrol edilir). Talep Gönder → maintenance_requests status = pending. Owner/manager push bildirimi alır. Onay → araç status = maintenance, maintenance_until set. Red → talep kapanır. Bakım bitince auto-checkout cron maintenance_until geçince aracı idle'a döndürür.`,
  },
  {
    source: '02-arac-yonetimi.md',
    heading: 'Authenticity check',
    content: `Yüklenen bakım fotoları otomatik kontrol edilir: EXIF metadata (tarih, kamera modeli, GPS), AI suspect (foto AI-generated mi), içerik sınıfı (vehicle / non_vehicle). Patron paneli "AI suphesi", "EXIF eksik", "Yanlış içerik" badge'leriyle gösterir.`,
  },

  // -------- 03-is-yonetimi.md --------
  {
    source: '03-is-yonetimi.md',
    heading: 'İş Oluşturma',
    content: `Bottom nav İşler → sağ üstte + (veya Hızlı Aksiyon Yeni İş). Form: Müşteri adı, alış adresi + harita pin, bırakış adresi (opsiyonel, ride'da müşteri sözlü verir), mesafe (km auto-hesaplanır), süre (dakika auto), şoför ataması (opsiyonel), notlar. Kaydet → status created veya assigned (driver atadıysan). Sadece owner ve manager iş oluşturabilir. Driver'a izin verirsen ride flow ile self-request yapar.`,
  },
  {
    source: '03-is-yonetimi.md',
    heading: 'İş Durumları (Status)',
    content: `created (henüz şoför atanmamış), assigned (şoföre atandı henüz başlamadı), in_progress (şoför başlattı devam ediyor), completed (tamamlandı), failed (şoför veya backend başarısız işaretledi), cancelled (müşteri veya yönetici iptal etti).`,
  },
  {
    source: '03-is-yonetimi.md',
    heading: 'İş Akışı (Driver tarafı)',
    content: `Driver İşler sekmesinde assigned durumdaki işleri görür. İşi tap → detay + alış-bırakış haritası + mini map. "Başla" → status in_progress, started_at set, harita rotası açılır. Apple Maps / Google Maps yönlendirmeyi açar. Driver pickup'a varır, müşteriyi alır. Dropoff'a varır → "Tamamla" → status completed, completed_at set. Tamamlandıktan sonra varsa müşteri rating modal'ı açılır.`,
  },
  {
    source: '03-is-yonetimi.md',
    heading: 'Filo Haritası',
    content: `Ana sayfada "Filo Haritasını Görüntüle" şeridi → haritada aktif araçlar (yeşil pin), bakımdaki araçlar (turuncu pin), boşta araçlar (gri pin), HQ konumu (lacivert pin). Pin'e tıklayınca araç + şoför + aktif iş özeti.`,
  },

  // -------- 04-ekip-davet.md --------
  {
    source: '04-ekip-davet.md',
    heading: 'Yetki Hiyerarşisi',
    content: `Owner (1 kişi, filo sahibi) → Manager'lar (N kişi) → Driver'lar (N kişi). Owner manager'ı davet eder. Manager driver'ı davet eder (veya owner direkt davet eder). Driver atanan bir manager'a bağlıdır (profiles.manager_id).`,
  },
  {
    source: '04-ekip-davet.md',
    heading: 'Davet Akışı',
    content: `Hesap > Ekip sekmesine git. Sağ üstte "Davet Et" butonu. Form: Ad-Soyad, E-posta (davet linki buraya gider), Rol (manager veya driver), Manager (driver için zorunlu — hangi yönetici altında çalışacak). Davet Gönder → 32-karakter token üretilir, e-posta linki gönderilir. Davet 7 gün geçerli.`,
  },
  {
    source: '04-ekip-davet.md',
    heading: 'Daveti Kabul Etme',
    content: `E-posta link'i veya manuel token girişi: Welcome ekranı → "Davet Kodum Var" butonu. Davet Kodu + E-posta + Şifre belirle. Kabul Et → davet token doğrulanır, profile oluşturulur, kişi filoya katılır.`,
  },
  {
    source: '04-ekip-davet.md',
    heading: 'İzinler (Permissions)',
    content: `Owner default tüm izinler açık. Manager default: araç görme/ekleme/güncelleme açık, araç silme kapalı, iş görme/oluşturma/atama açık, iş iptali kapalı (kritik), ekip davet açık, ekipten çıkarma kapalı (kritik), raporlar açık, bakıma alma + onay açık. Driver default: araç görme açık, araç ekleme/güncelleme/silme kapalı, iş görme açık, iş oluşturma/atama/iptal kapalı, ekip yönetimi kapalı, raporlar kapalı, bakıma alma talebi açık, bakım onaylama kapalı.`,
  },
  {
    source: '04-ekip-davet.md',
    heading: 'İzin Override',
    content: `Hesap > Ekip → kişi tap → İzinler ekranı. Her izin satırında toggle — default'tan farklı override koy. Critical izinler (silme, iptal, ekipten çıkarma) sarı uyarı ile işaretli. Kaydet → ilgili kişiye anlık bildirim gider. Override'lar permission_grants tablosunda saklanır.`,
  },
  {
    source: '04-ekip-davet.md',
    heading: 'Ekipten Çıkarma',
    content: `Ekip → kişi tap → detay. Sağ üstte çöp kutusu ikonu (sadece owner). İki adımlı onay. Çıkarılan kişi: Profile silinir, üzerindeki araçlar serbest bırakılır, aktif işleri pending duruma döner (yeniden atanmalı), login yapamaz.`,
  },

  // -------- 05-ride-entegrasyon.md --------
  {
    source: '05-ride-entegrasyon.md',
    heading: 'Genel Ride Akışı',
    content: `Müşteri Ride App'te "Araç Çağır" tap → ride_search_vehicles uygun şoför+araç listesi. Spesifik araç seç → request_ride assigned. Fleet'teki driver'a push notification gider. Driver bildirimi açar → driver-ride ekranı. Aktif yolculuk takibi her iki tarafta.`,
  },
  {
    source: '05-ride-entegrasyon.md',
    heading: 'Ride App\'ten Görünmek',
    content: `Filodaki araç müşteri tarafından çağrılabilir hale gelmesi için: Hesap > Ride Ayarları ekranında "Ride'a açıkken" toggle (ride_enabled = true), Hizmet alanı (HQ merkezli daire, varsayılan 30 km), Mesai saatleri (NULL ise 7/24). Driver hazırlığı: profile.status = active, üzerinde araç olmalı, araç status idle ve bakımda değil, driver aktif başka ride'da olmamalı.`,
  },
  {
    source: '05-ride-entegrasyon.md',
    heading: 'ride_search_vehicles filtreleri',
    content: `Backend müşteriye gösterdiği araçlar: vehicle.status = idle, vehicle.current_user_id IS NOT NULL, vehicle.maintenance_started_at IS NULL, fleets_visibility.ride_enabled = true, is_fleet_open mesai içinde, driver profile.status = active, driver role = driver, driver aktif ride'da DEĞİL, müşteri pickup konumu service_area içinde.`,
  },
  {
    source: '05-ride-entegrasyon.md',
    heading: 'Driver Yolculuk Akışı',
    content: `Müşteri çağırınca driver fleet app'te: banner notification (foreground) veya push (background). Tap → driver-ride.tsx ekranı. Müşteri adı + foto, pickup adresi + harita, tahmini km + dakika, "Müşteriye Yaklaşıyor" buton. Akış: "Geldim" → driver_arrived RPC → status driver_arrived. "Yolculuğa Başla" → start_ride RPC → status in_progress. "Tamamla" → complete_ride RPC → status completed. Sonra rating modal: 1-5 yıldız + opsiyonel yorum, submit_driver_rating RPC.`,
  },

  // -------- 06-sss.md --------
  {
    source: '06-sss.md',
    heading: 'Bir araç bakımda iken iş atayabilir miyim?',
    content: `Hayır. Backend request_ride ve assign_job RPC'leri kontrol eder: vehicle.maintenance_started_at IS NULL olmalı. Aksi halde T9 hatası döner.`,
  },
  {
    source: '06-sss.md',
    heading: 'Bir araç birden fazla şoför üzerine alabilir mi?',
    content: `Hayır. Bir araç aynı anda tek bir kişinin üzerinde olur (vehicles.current_user_id UUID, single). Ama bir kişi aynı anda birden fazla araç üzerinde olabilir.`,
  },
  {
    source: '06-sss.md',
    heading: 'Müşteri filosunu görmüyor — neden?',
    content: `1. Hesap > Ride Ayarları açık mı (ride_enabled = true). 2. Aracın status'u idle mi (bakımda veya aktif iş varsa görünmez). 3. Driver üzerinde mi (current_user_id). 4. Driver profile.status = active mi (mola/mesai dışı değil). 5. Müşteri pickup konumu hizmet alanın içinde mi (varsayılan 30 km HQ buffer). 6. Mesai içinde mi (operating_hours).`,
  },
  {
    source: '06-sss.md',
    heading: 'Hangi cihazlarda çalışır?',
    content: `Android 7.0+ (API 24+) şu an aktif. iOS ertelendi (Apple Developer üyeliği sonrası).`,
  },
  {
    source: '06-sss.md',
    heading: 'Bakım foto\'mu kontrol ediliyor mu?',
    content: `Evet. Yüklediğin foto otomatik 3 katmanlı kontrol geçer: EXIF metadata (foto tarihi, kamera modeli — yok ise "EXIF eksik" badge), AI suspect (AI-generated mi, >0.7 ise "AI şüphesi" badge), içerik sınıfı (vehicle / non_vehicle — yanlış foto ise "Yanlış içerik" badge). Otomatik red yok, onay verecek owner/manager bu badge'leri görür.`,
  },
];
