# DriverMesh — Web Landing

Tek dosya statik landing site. `drivermesh.com` domain'ine deploy edilecek.

## Yapı

```
web/
├── index.html              # tek-dosya landing (inline CSS + JS)
├── assets/
│   ├── hero-tr.jpg         # TR hero görseli
│   ├── hero-en.jpg         # EN hero görseli
│   └── logo.png            # App icon
├── functions/
│   └── api/
│       └── contact.ts      # Cloudflare Pages Function — Telegram bot proxy
└── README.md
```

## Özellikler

- **TR / EN dil toggle** — header sağ üstte pill, seçim `localStorage`'a kayıt. Tarayıcı dili otomatik tahmin (`navigator.language`).
- **Responsive** — 860px altında hero tek sütun + nav links gizli.
- **Tema** — uygulamanın lacivert (#0A0E1F) + turuncu (#FF7A1A) + mor mesh background'una bire bir uyumlu.
- **Bağımsız** — CDN'den asset yüklemiyor, framework gerektirmiyor, build adımı yok. Direkt static host.

## Lokal önizleme

**Sadece statik HTML için** (form çalışmaz, `/api/contact` 404 verir):
```bash
cd web && npx serve .
# veya
cd web && python -m http.server 8000
```

**Pages Function dahil tam ortam** (form Telegram'a düşer):
```bash
# wrangler.toml gerekmiyor — pages dev `web/functions/` klasörünü otomatik bulur
npx wrangler pages dev web --port 5500 \
  --binding TELEGRAM_BOT_TOKEN=<bot_token> \
  --binding TELEGRAM_CHAT_ID=<chat_id>
```

## İletişim formu — Telegram entegrasyonu

`functions/api/contact.ts` Cloudflare Pages Function:
- Form POST'u alır, doğrular (zorunlu alanlar, e-posta regex, honeypot)
- IP-bazlı rate limit (60 sn / 3 istek, Worker instance memory)
- Telegram Bot API `sendMessage` çağırır (HTML parse_mode)
- Token + chat_id **env var** olarak gelir → client'a sızmaz

**Mesaj formatı** (Telegram'a düşen):
```
🚐 DriverMesh — Yeni İletişim

👤 Ad: ...
✉️ E-posta: ...
📌 Konu: ...

💬 Mesaj:
...

🌐 tr · https://drivermesh.com/#contact
🕐 2026-05-12 21:34:00 UTC · IP: ...
🖥 Mozilla/5.0 ...
```

**Env var kurulumu (Cloudflare Pages)**:
1. Cloudflare Dashboard → **Workers & Pages** → drivermesh → **Settings** → **Environment variables**
2. Production'a ekle:
   - `TELEGRAM_BOT_TOKEN` — Telegram BotFather'dan alınan token
   - `TELEGRAM_CHAT_ID` — bot'un mesaj atacağı chat id (kendi user id'n veya bir grup chat id'si)
3. Preview environment için ayrı değer set edilebilir.

## Live Fleet Map — Google Maps JS API

`#live-map` section uygulamadaki fleet-map ekranıyla bire bir görünüme sahip Google Maps embed içerir:
- **Dark style** — uygulamadaki #0A0E1F lacivert + #1A1E40 yol renkleriyle uyumlu
- **HQ marker** (lavender, "ÜS" yazılı, pulse animation)
- **3 vehicle pill** — gerçek İstanbul koordinatlarında pickup→dropoff arasında loop'lu hareket
- **Kesik polyline rotalar** — turuncu / mavi / yeşil
- **Pickup/dropoff pin'leri**

### API key kurulumu

1. **Google Cloud Console** → APIs & Services → Library → **Maps JavaScript API** etkinleştir
2. **Credentials** → **Create credentials → API key**
3. Yeni key'e **HTTP referrer restriction** ekle:
   - `https://drivermesh.com/*`
   - `https://www.drivermesh.com/*`
   - lokal test için `http://localhost:5500/*`
4. API restriction → sadece **Maps JavaScript API**

### Deploy öncesi key'i HTML'e yaz

`web/index.html` head'inde:
```html
<script>window.__GMAPS_KEY__ = '__GOOGLE_MAPS_KEY__';</script>
```
satırını gerçek key ile değiştir (deploy script'i veya manuel):
```html
<script>window.__GMAPS_KEY__ = 'AIzaSy...';</script>
```

**Alternatif — Cloudflare Pages env var ile inject** (daha temiz, commit'e key sızmasın):
Build hook script'i deploy zamanında `__GOOGLE_MAPS_KEY__` token'ını `${GMAPS_KEY_WEB}` env var ile değiştirir. Bu setup için `wrangler.toml` veya bir build adımı gerek.

Key girilmezse landing açılır, sadece map yerine "Harita yüklenemedi" fallback'i gösterir — diğer bölümler etkilenmez.

## Telegram setup (devam)

**Yeni bir prod bot oluşturmak için** (mevcut test bot kişisel kullanıma):
1. Telegram'da `@BotFather` ile sohbet → `/newbot` → bot adı + username
2. Bot token gelir → Cloudflare env var'a yaz
3. Bot ile sohbet başlat (`/start` mesajı at)
4. `https://api.telegram.org/bot<TOKEN>/getUpdates` aç → mesajının `chat.id`'sini al → Cloudflare env var'a yaz

## Cloudflare Pages deploy

### 1. Cloudflare hesabı + Wrangler CLI

```bash
npm i -g wrangler
wrangler login
```

### 2. Pages projesi oluştur

```bash
cd web
wrangler pages deploy . --project-name drivermesh
```

İlk deploy'da Cloudflare bir `*.pages.dev` URL'i verir. Test edip onaylayalım.

### 3. Custom domain bağla

Cloudflare Dashboard'da:
1. **Workers & Pages** → drivermesh → **Custom domains**
2. **Set up a custom domain** → `drivermesh.com` ve `www.drivermesh.com`
3. DNS Cloudflare'da yönetiliyorsa otomatik kurulur, değilse `CNAME` `drivermesh.com → drivermesh.pages.dev`

### Alternatif: Vercel deploy

```bash
npm i -g vercel
cd web
vercel --prod
```

`vercel.json` gerekmiyor, Vercel statik dosyaları otomatik serve eder. Custom domain için: Vercel Dashboard → Project → Domains → `drivermesh.com` ekle, DNS kayıt önerilerini uygula.

## Sıradakiler (TODO)

- [ ] **`/privacy.html`** — KVKK + GDPR uyumlu gizlilik politikası (mağaza zorunluğu)
- [ ] **`/terms.html`** — Kullanım koşulları
- [ ] **Email opt-in** — `hello@drivermesh.com` ile email tutmak yerine Mailchimp/Resend ile form
- [ ] **App Store / Play badge'leri** — gerçek linkler yayın sonrası
- [ ] **App screenshots gallery** — `screenshots/` klasöründen seçilmiş 4-5 görsel
- [ ] **OG image özelleştirilmiş** — Twitter/Facebook için 1200×630 banner
- [ ] **Analytics** — Cloudflare Web Analytics (gizliliğe duyarlı, cookie'siz)
- [ ] **Sitemap.xml + robots.txt** — SEO için
