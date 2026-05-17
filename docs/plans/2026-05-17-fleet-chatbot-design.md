# Fleet Chatbot — Tasarım Dokümanı V0.1

> **Tarih:** 2026-05-17
> **Hedef:** DriverMesh Fleet uygulamasına in-app AI yardım botu eklemek — kullanıcı uygulamayı tanısın, sorduğu sorulara doğal dilde cevap alsın, kesinlikle cevapsız kalmasın.
>
> **Status:** Tasarım onaylandı, implementasyon bekleniyor.

---

## 1. Amaç ve Scope

### Hedef kullanıcı kitlesi
- **Owner** — filoyu kuran, "Nasıl yönetici davet ederim?", "Filo Ritmi kartı neyi gösterir?"
- **Manager** — "Bakıma alma talebini nasıl onaylarım?", "İş atama akışı nedir?"
- **Driver** — "Atanan iş nasıl başlatılır?", "Aracı üzerime nasıl alırım?"

### V0.1 Scope (yapılacak)
- Onboarding modal → demo guided tour (sayfa sayfa anlatım)
- Her ekranda erişim noktası (header'da Bell'in solunda)
- Free-text soru-cevap (Gemini Flash + Cloudflare AI fallback)
- Mesaj geçmişi persist (Supabase, RLS)
- TR + EN dil desteği

### V0.1 Out-of-scope (sonraya)
- Sesli sohbet
- Dosya/foto upload (kullanıcı tarafından)
- Embedding-based RAG (V0.1'de keyword RAG yeterli)
- Bot tarafından action tetikleme ("benim için yeni iş aç" gibi tool use) — V0.2

---

## 2. Mimari Özet

```
┌────────────────────────────────────────┐
│ Mobile (Fleet RN app)                   │
│  ┌────────────────────────────────┐    │
│  │ ChatBotBadge (header)          │    │
│  │ OnboardingWelcome (1st launch) │    │
│  │ GuidedTourOverlay (demo)       │    │
│  │ chatbot.tsx (mesaj ekranı)     │    │
│  └────────────┬───────────────────┘    │
└───────────────┼────────────────────────┘
                │ POST /functions/v1/chat-bot
                │ { sessionId, message }
                │ Authorization: Bearer <JWT>
                ▼
┌────────────────────────────────────────┐
│ Supabase Edge Function: chat-bot       │
│ 1. JWT validate                         │
│ 2. session_id verify / create           │
│ 3. KB chunks lookup (keyword RAG)       │
│ 4. user message → DB (chat_messages)    │
│ 5. Gemini Flash 1.5 call (5s timeout)   │
│    └─ fail → Cloudflare AI (5s)         │
│       └─ fail → hardcoded fallback      │
│ 6. assistant message → DB               │
│ 7. response                             │
└────────────────────────────────────────┘
                │
                ▼
        Supabase Postgres
        ├── chat_sessions
        ├── chat_messages
        └── (RLS: user owns rows)
```

**Güvenlik garantileri:**
- AI API key'leri sadece edge function'da (`Deno.env.GEMINI_API_KEY`, `CF_API_TOKEN`)
- APK içinde key görünmez
- JWT validate her istekte
- RLS: kullanıcı sadece kendi session/mesajlarını görür

---

## 3. AI Sağlayıcı Stratejisi

### Primary: Google Gemini Flash 1.5

| | |
|---|---|
| Endpoint | `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent` |
| Free tier | 15 RPM, 1500 RPD, 1M tokens/day |
| Türkçe | Güçlü (Google Translate altyapısı) |
| API key | Google AI Studio'dan (1 dakikada alınır) |
| Env var | `GEMINI_API_KEY` |

### Fallback: Cloudflare Workers AI (Llama 3.1 8B)

| | |
|---|---|
| Endpoint | `https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/ai/run/@cf/meta/llama-3.1-8b-instruct` |
| Free tier | 10K requests/day |
| Türkçe | Orta (Llama 3.1 multi-language) |
| Env vars | `CF_API_TOKEN`, `CF_ACCOUNT_ID` |

### Failover Logic (`callAI()`)

```ts
async function callAI(prompt: string): Promise<{ text: string; provider: string }> {
  // Try Gemini with 5s timeout
  try {
    const response = await Promise.race([
      callGemini(prompt),
      timeout(5000),
    ]);
    return { text: response, provider: 'gemini' };
  } catch (e) {
    console.warn('[chat-bot] Gemini failed, falling back to CF:', e.message);
  }

  // Try Cloudflare with 5s timeout
  try {
    const response = await Promise.race([
      callCloudflare(prompt),
      timeout(5000),
    ]);
    return { text: response, provider: 'cloudflare' };
  } catch (e) {
    console.warn('[chat-bot] CF failed, returning hardcoded:', e.message);
  }

  // Hardcoded last-resort message
  return {
    text: 'Üzgünüm, şu anda cevap üretemiyorum. Destek ekibimize ulaşmak ister misin?',
    provider: 'hardcoded',
  };
}
```

**Müşteri kesinlikle cevapsız kalmaz** — 3 katmanlı garanti.

---

## 4. Komponent ve Dosya Planı

### Yeni dosyalar

```
fleet/
├── app/(app)/chatbot.tsx                # Chat ekranı (full screen modal)
├── src/components/
│   ├── ChatBotBadge.tsx                 # Header'da Bell'in SOLUNDA — chatbot.webp ikon + "AI Asistan" yazı
│   ├── OnboardingWelcome.tsx            # İlk açılış modal — "Demo'da tanıtayım mı?"
│   └── GuidedTourOverlay.tsx            # Demo sırasında element highlight + tooltip bubble
├── src/chatbot/
│   ├── client.ts                        # Edge function fetch wrapper
│   ├── tour.ts                          # Tour adımları array (rota + selector + metin)
│   ├── prompts.ts                       # System prompt'lar (TR/EN, role-aware)
│   └── types.ts                         # ChatMessage, ChatSession types
├── assets/chatbot.webp                  # ★ Bot avatar (header ikonu + chat ekranında)
├── docs/help/                           # Bilgi tabanı — markdown dosyalar
│   ├── 01-baslarken.md                  # "Yeni Filo Kurma" akışı
│   ├── 02-arac-yonetimi.md              # Araç ekleme/güncelleme/bakım
│   ├── 03-is-yonetimi.md                # İş oluşturma, atama, takip
│   ├── 04-ekip-davet.md                 # Şoför/yönetici davet, izinler
│   ├── 05-ride-entegrasyon.md           # B2C ride flow, claim_vehicle
│   └── 06-sss.md                        # En sık sorular + kısa cevaplar

supabase/
├── functions/chat-bot/
│   ├── index.ts                         # Deno edge fn — Gemini → CF fallback
│   ├── kb.ts                            # docs/help/*.md runtime load + keyword search
│   ├── gemini.ts                        # Gemini API client
│   └── cloudflare.ts                    # Cloudflare AI client
└── migrations/
    └── 2026XXXX_chat_bot.sql            # chat_sessions + chat_messages + RLS
```

### Değişen dosyalar

| Dosya | Değişiklik |
|---|---|
| `fleet/app/(app)/index.tsx` | Header'a `<ChatBotBadge />` Bell'in SOLUNDA |
| `fleet/app/_layout.tsx` | RootLayout'a `<OnboardingWelcome />` mount (first-launch check via AsyncStorage) |
| `fleet/app/(app)/_layout.tsx` | `<GuidedTourOverlay />` mount (`tourActive` flag iken) |
| `fleet/src/i18n/locales/tr.json` + `en.json` | `chatbot.*` namespace (UI metinleri) |

---

## 5. Bilgi Tabanı Stratejisi (Keyword RAG, V0.1)

### Yaklaşım
- `docs/help/*.md` markdown dosyalar EDGE FUNCTION içinde **deploy başına bir kez** yüklenir (in-memory cache)
- Her doc heading'lere göre chunk'lara bölünür (her `##` bir chunk başlangıcı, içerik 200-400 kelime)
- Soruda geçen anahtar kelimeler (lowercase + accent-strip) tüm chunk'larda aranır, **eşleşme skoru**'na göre top 3 chunk system prompt'a inject edilir
- Eşleşme skoru: chunk'taki kelime eşleşmelerinin TF-IDF benzeri normalizasyonu (basit)

### Örnek
**Soru:** "Aracın üzerine nasıl alırım?"
**Eşleşen chunk'lar:**
1. `02-arac-yonetimi.md` § "Aracı üzerine alma" (skor 0.85)
2. `02-arac-yonetimi.md` § "claim_vehicle_for_ride RPC" (skor 0.62)
3. `05-ride-entegrasyon.md` § "Driver araç sahiplenme" (skor 0.48)

### System prompt yapısı

```
Sen DriverMesh Fleet uygulamasının AI yardım asistanısın.
Türkçe ve İngilizce konuşabilirsin. Kullanıcı: {role} ({email}).
Aşağıdaki bilgileri kullanarak SADECE DOĞRU bilgi ver.
Eğer bilmiyorsan "Bu konuda detay göremiyorum, destek formu aç" de.

İlgili bilgi:
---
{kb_chunk_1}
---
{kb_chunk_2}
---
{kb_chunk_3}
```

### V0.2 (sonra): Embedding-based RAG
- Supabase pgvector extension
- Doc'lardan chunk'lar embed edilir (Gemini embedding model `text-embedding-004`)
- Soru embed edilir, cosine similarity top-k

---

## 6. Onboarding + Guided Tour Akışı

### İlk açılış (AsyncStorage `firstLaunch` flag yoksa)

```
App boot → RootLayout mount
   ↓
AsyncStorage.getItem('chatbot.firstLaunch') === null
   ↓
<OnboardingWelcome /> modal açılır
   ↓
[Modal içeriği]
   • <Image source={chatbot.webp} /> 80x80
   • "Merhaba, ben DriverMesh asistanı 👋"
   • "Uygulamayı demo modunda tanıtayım mı? 5 dakikada her şeyi görmüş olursun."
   • CTA: "Hadi başlayalım" | "Daha sonra"
   ↓
"Hadi başlayalım" → router.push('/(auth)/welcome')
                  + AsyncStorage.setItem('chatbot.tourActive', 'true')
                  + AsyncStorage.setItem('chatbot.firstLaunch', 'false')
   ↓
Welcome ekranı
   ↓
GuidedTourOverlay tetiklenir, Step 1 başlar:
   • "Demo App" butonunun çevresine pulsing ring animasyonu
   • Üstte tooltip bubble: "👉 'Demo App' butonuna dokun"
   • Kullanıcı dokununca → demo session aktif → home'a router push
```

### Demo'da Guided Tour Adımları

`src/chatbot/tour.ts`:

```ts
export const TOUR_STEPS: TourStep[] = [
  {
    id: 'home-welcome',
    route: '/(app)/',
    target: 'header-greeting',         // testID veya layout measure
    title: 'Ana Sayfa',
    body: 'Burası ana sayfa. Filo durumun, hızlı aksiyonlar ve bugünkü işler burada.',
    cta: 'Devam',
  },
  {
    id: 'home-fleet-rhythm',
    route: '/(app)/',
    target: 'fleet-rhythm-card',
    title: 'Filo Ritmi',
    body: 'Bu kart filodaki araçların aktif/idle/bakım dağılımını gösterir.',
    cta: 'Devam',
  },
  {
    id: 'home-quick-actions',
    route: '/(app)/',
    target: 'quick-actions-grid',
    title: 'Hızlı Aksiyon',
    body: 'Buradan hızlıca yeni iş, kişi, araç ekleyebilirsin.',
    cta: 'Devam',
  },
  {
    id: 'nav-jobs',
    route: '/(app)/',
    target: 'bottom-nav-jobs',
    title: 'İşler Sekmesi',
    body: 'Şimdi "İşler" sekmesine dokun, oradaki listeyi gösterelim.',
    cta: null,                         // user must tap the target
    waitForTap: true,
  },
  {
    id: 'jobs-list',
    route: '/(app)/jobs',
    target: 'jobs-list',
    title: 'İş Listesi',
    body: 'Burada filodaki tüm işler durumlarına göre listelenir.',
    cta: 'Devam',
  },
  {
    id: 'nav-fleet',
    route: '/(app)/jobs',
    target: 'bottom-nav-fleet',
    title: 'Filo Sekmesi',
    body: '"Filo" sekmesine dokun — araçların burada.',
    cta: null,
    waitForTap: true,
  },
  {
    id: 'vehicles-list',
    route: '/(app)/vehicles',
    target: 'vehicles-list',
    title: 'Araç Listesi',
    body: 'Her araç status badge ve son driver bilgisiyle listelenir.',
    cta: 'Devam',
  },
  {
    id: 'nav-account',
    route: '/(app)/vehicles',
    target: 'bottom-nav-account',
    title: 'Hesap Sekmesi',
    body: 'Son olarak "Hesap" sekmesine dokun.',
    cta: null,
    waitForTap: true,
  },
  {
    id: 'account-overview',
    route: '/(app)/account',
    target: 'account-screen',
    title: 'Hesap & Ayarlar',
    body: 'Profil, HQ ayarları, destek formu burada.',
    cta: 'Devam',
  },
  {
    id: 'final',
    route: '/(app)/account',
    target: 'chatbot-badge',
    title: 'Hazırsın 🎉',
    body: 'Tour bitti. Sağ üstteki AI Asistan ikonuna her zaman dokunup soru sorabilirsin.',
    cta: 'Bitir',
  },
];
```

### Tour bitince

```
AsyncStorage.setItem('chatbot.tourActive', 'false')
AsyncStorage.setItem('chatbot.tourCompleted', 'true')
→ signOutDemo()
→ router.replace('/(auth)/welcome')
→ Kullanıcı gerçek hesabıyla giriş yapar
```

---

## 7. UI Detayları

### ChatBotBadge (Home Header — Bell'in solunda)

**Mevcut header yapısı** (`fleet/app/(app)/index.tsx` L147-168):
```tsx
<View style={styles.header}>
  <View style={styles.headerLeft}>
    <Avatar ... />
    <View style={styles.headerText}> ... </View>
  </View>
  <View style={styles.headerRight}>
    <Pressable onPress={() => router.push('/(app)/notifications')}>
      <Feather name="bell" size={28} />
    </Pressable>
  </View>
</View>
```

**Yeni hali:**
```tsx
<View style={styles.headerRight}>
  <Pressable onPress={() => router.push('/(app)/chatbot')}>
    <View style={styles.chatBotBadge}>
      <Image source={require('@/assets/chatbot.webp')} style={styles.chatBotIcon} />
      <Text style={styles.chatBotLabel}>{t('chatbot.badge')}</Text>
    </View>
  </Pressable>
  <Pressable onPress={() => router.push('/(app)/notifications')}>
    <Feather name="bell" size={28} />
  </Pressable>
</View>
```

**Stil:**
- Pill-shaped (border radius full), padding `(6, 10)`
- Background: `theme.colors.accentMuted` (turuncu hafif)
- İkon: 24x24 chatbot.webp
- Yazı: "AI Asistan" / "AI Assistant", `font.size.xs`, `font.weight.semibold`

### ChatBot Screen (`app/(app)/chatbot.tsx`)

**Layout:**
```
┌────────────────────────────────────────┐
│ ← AI Asistan                    ⋯ ≡    │  ← top bar
├────────────────────────────────────────┤
│                                         │
│ [chatbot.webp]                          │
│ Merhaba! Filo yönetiminde yardım      │  ← bot bubble (sol)
│ etmek için buradayım.                   │
│                                         │
│ Önerilen sorular:                       │
│  • Yeni araç nasıl eklerim?             │  ← quick replies
│  • Bakım talebi nasıl açılır?           │
│  • Şoför davet etme akışı?              │
│                                         │
│                                         │
│  Aracı bakıma nasıl alırım?  ← user bubble (sağ, turuncu) │
│                                         │
│ Bakım talebi açmak için:                │  ← bot bubble (sol)
│ 1. ...                                  │
│                                         │
├────────────────────────────────────────┤
│ [Mesajını yaz...]              ➤       │  ← input + send
└────────────────────────────────────────┘
```

**Bot bubble:**
- Avatar: `chatbot.webp` 32x32, yuvarlak
- Background: `theme.colors.surface` (lacivert)
- Tekst: `theme.colors.text`

**User bubble:**
- Background: `theme.colors.accent` (turuncu)
- Tekst: white
- Sağ aligned

**Typing indicator:** 3 nokta animasyonu, bot avatar yanında

---

## 8. Backend — Supabase Edge Function

### `supabase/functions/chat-bot/index.ts`

```ts
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { loadKB, searchKB } from './kb.ts';
import { callGemini } from './gemini.ts';
import { callCloudflare } from './cloudflare.ts';

const KB = loadKB(); // module-load time, 1 kere

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  // 1. JWT validate
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  // 2. Body
  const { sessionId, message } = await req.json() as { sessionId: string; message: string };

  // 3. Profile (role-aware prompt)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, organization_id')
    .eq('id', user.id)
    .single();

  // 4. History (last 10)
  const { data: history } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(10);

  // 5. RAG: KB chunks
  const kbChunks = searchKB(KB, message, 3);

  // 6. Insert user message
  await supabase.from('chat_messages').insert({
    session_id: sessionId,
    user_id: user.id,
    role: 'user',
    content: message,
  });

  // 7. Build prompt + call AI with failover
  const systemPrompt = buildPrompt(profile?.role ?? 'driver', profile?.full_name, kbChunks);
  const start = Date.now();
  let result: { text: string; provider: string };

  try {
    result = await raceWithTimeout(callGemini(systemPrompt, history?.reverse() ?? [], message), 5000);
    result.provider = 'gemini';
  } catch (e1) {
    console.warn('[chat-bot] gemini failed:', e1.message);
    try {
      result = await raceWithTimeout(callCloudflare(systemPrompt, history?.reverse() ?? [], message), 5000);
      result.provider = 'cloudflare';
    } catch (e2) {
      console.warn('[chat-bot] cloudflare failed:', e2.message);
      result = {
        text: 'Üzgünüm, şu anda cevap üretemiyorum. Destek formunu kullanır mısın? Hesap → Destek',
        provider: 'hardcoded',
      };
    }
  }

  // 8. Insert assistant message
  await supabase.from('chat_messages').insert({
    session_id: sessionId,
    user_id: user.id,
    role: 'assistant',
    content: result.text,
    metadata: { provider: result.provider, latency_ms: Date.now() - start },
  });

  return new Response(JSON.stringify({ reply: result.text, provider: result.provider }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

function raceWithTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}

function buildPrompt(role: string, name: string | null, kbChunks: string[]): string {
  return `Sen DriverMesh Fleet uygulamasının AI yardım asistanısın.
Türkçe ve İngilizce konuşabilirsin. Kullanıcı: ${name ?? 'Kullanıcı'} (${role}).
Aşağıdaki bilgileri kullanarak SADECE DOĞRU bilgi ver. Kibar ve kısa ol.
Bilmiyorsan: "Bu konuda detay göremiyorum, destek formu aç" de.

İlgili bilgi:
${kbChunks.map((c, i) => `--- chunk ${i + 1} ---\n${c}`).join('\n')}`;
}
```

### Env vars (Supabase Dashboard → Edge Functions → Secrets)

```
GEMINI_API_KEY=...                   # Google AI Studio
CF_API_TOKEN=...                     # Cloudflare API token (Workers AI scope)
CF_ACCOUNT_ID=...                    # Cloudflare account ID
```

---

## 9. Database Schema

### `supabase/migrations/2026XXXX_chat_bot.sql`

```sql
-- ============================================================
-- DriverMesh Chatbot (V0.1) — chat_sessions + chat_messages
-- 2026-05-17
-- ============================================================

CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  title           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_sessions_user
  ON public.chat_sessions(user_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content     TEXT NOT NULL,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_messages_session
  ON public.chat_messages(session_id, created_at);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own sessions"
  ON public.chat_sessions FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users see own messages"
  ON public.chat_messages FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- Trigger: chat_sessions.last_message_at otomatik güncelle
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_session_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.chat_sessions
  SET last_message_at = NEW.created_at
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE TRIGGER trg_chat_messages_update_session
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_session_last_message();
```

---

## 10. İmplementasyon Sırası

| Adım | İş | Çıktı |
|---|---|---|
| 1 | DB migration uygula | `chat_sessions` + `chat_messages` tabloları live |
| 2 | `docs/help/` 6 markdown yaz | Bilgi tabanı hazır |
| 3 | Supabase env vars set | `GEMINI_API_KEY`, `CF_API_TOKEN`, `CF_ACCOUNT_ID` |
| 4 | Edge function deploy | `chat-bot` + `kb.ts` + AI provider clients |
| 5 | Mobile: types + client | `src/chatbot/types.ts` + `client.ts` |
| 6 | Mobile: ChatBotBadge | Header'da Bell solunda görünür |
| 7 | Mobile: chatbot.tsx | Mesaj listesi + input + quick replies |
| 8 | Mobile: i18n keys | `chatbot.*` TR/EN |
| 9 | Mobile: OnboardingWelcome | İlk açılış modal |
| 10 | Mobile: GuidedTourOverlay | Demo'da tooltip + ring animation |
| 11 | Mobile: tour.ts | Tour adımları array |
| 12 | Test | Manuel akış, failover, RLS |
| 13 | Telemetri | Sentry breadcrumb |

---

## 11. Test Stratejisi

### Manuel test (smoke)
- [ ] İlk açılışta OnboardingWelcome modal görünüyor mu
- [ ] "Hadi başlayalım" → Welcome ekranında Demo App highlight ediliyor mu
- [ ] Demo App tap → tour başlıyor mu, sayfa sayfa ilerliyor mu
- [ ] Tour bitince demo signout + Welcome'a dönüyor mu
- [ ] Home header'da AI Asistan badge görünüyor mu (Bell'in solunda)
- [ ] Badge tıklayınca chatbot ekranı açılıyor mu
- [ ] Soru sorma → cevap geliyor mu (Gemini çalışıyorsa)
- [ ] Quick reply tıklama → mesaj olarak gönderiliyor mu
- [ ] Mesaj history persist ediyor mu (uygulama restart sonrası)

### Failover test
- [ ] Gemini API key invalid → CF'e düşüyor mu (edge function log'da `provider: cloudflare`)
- [ ] CF API key invalid → hardcoded mesaj geliyor mu
- [ ] Edge function 5s'den uzun sürerse client timeout handle ediyor mu

### Güvenlik test
- [ ] JWT olmadan istek → 401
- [ ] Başka user'ın session_id'siyle istek → RLS engellemeli (boş history)
- [ ] APK içinde API key görünmüyor mu (decompile + grep)

---

## 12. Açık Kararlar / TODO V0.2

1. **Session limit per user?** V0.1'de limitsiz. Bot kötüye kullanılırsa rate limit gerekebilir.
2. **Telemetry:** Bot kullanım metric'leri Sentry'e mi (event), Supabase'e mi (analytics table)?
3. **Rate limit:** Edge function'da `user_id`-bazlı 60 req/dakika limit (Redis veya Postgres sliding window).
4. **KB güncelleme akışı:** V0.1'de markdown deploy ile gelir (function redeploy gerekir). V0.2'de Supabase Storage + dynamic load.
5. **Tool use (function calling):** V0.2'de bot "benim için yeni iş aç" diyebilir; Gemini function calling + Supabase RPC çağrı.
6. **iOS:** Android-only (memory: `project_android_only_track.md`). iOS açılınca aynı bileşenler portable.
7. **Mesaj geçmişi UI:** V0.1'de chatbot.tsx tek session. V0.2'de session listesi (geçmiş sohbetler).
8. **Owner için filo verisi sorgulama:** "Bugün kaç iş bitti?" gibi sorularda bot Supabase'den canlı veri çekmeli — V0.2 tool use.

---

## Asset

`fleet/assets/chatbot.webp` — bot avatar (masaüstünden kopyalandı, kullanıcı sağladı).

---

## Onay durumu

- [x] Mimari özet — onaylandı
- [x] Dosya planı — onaylandı
- [x] AI sağlayıcı stratejisi — Gemini primary + CF fallback onaylandı
- [x] UI girişi — onboarding sonrası + header'da Bell'in solunda AI Asistan
- [x] Doc'lar güncellendi (CI_CD_SETUP, RELEASE_CHECKLIST, ARCHITECTURE)
- [ ] İmplementasyon başlatma onayı bekleniyor

---

> **Sonraki adım:** Kullanıcı onay verirse, sıralı implementasyon (yukarıda 13 adım) başlar. İlk adım DB migration uygulama (Supabase MCP veya manuel SQL Editor).
