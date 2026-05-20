// DriverMesh Fleet Chatbot — Supabase Edge Function
//
// Endpoint: POST /functions/v1/chat-bot
// Body: { sessionId: string, message: string }
// Headers: Authorization: Bearer <supabase JWT>
//
// Akış:
//   1. JWT validate
//   2. Session_id varsa kontrol, yoksa oluştur
//   3. KB chunks lookup (keyword RAG)
//   4. user message → chat_messages
//   5. Gemini Flash 1.5 call (5s timeout)
//      └─ fail → Cloudflare AI fallback (5s)
//         └─ fail → hardcoded mesaj
//   6. assistant message → chat_messages
//   7. response

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { searchKB } from './kb.ts';
import { callGemini } from './gemini.ts';
import { callCloudflare } from './cloudflare.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ChatRequest {
  sessionId?: string;
  message: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  try {
    // 1. JWT validate via Supabase client w/ caller's token
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return jsonResponse({ error: 'unauthorized' }, 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return jsonResponse({ error: 'unauthorized' }, 401);
    }

    // 2. Parse body
    const body = (await req.json()) as ChatRequest;
    if (!body.message || typeof body.message !== 'string' || body.message.trim().length === 0) {
      return jsonResponse({ error: 'message_required' }, 400);
    }
    if (body.message.length > 4000) {
      return jsonResponse({ error: 'message_too_long' }, 400);
    }

    // 3. Profile (role + org)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name, organization_id')
      .eq('id', user.id)
      .maybeSingle();

    // 4. Session: var olanı kullan veya yeni oluştur
    let sessionId = body.sessionId;
    if (!sessionId) {
      const { data: newSession, error: sessionErr } = await supabase
        .from('chat_sessions')
        .insert({
          user_id: user.id,
          organization_id: profile?.organization_id ?? null,
          title: body.message.slice(0, 60),
        })
        .select('id')
        .single();
      if (sessionErr || !newSession) {
        console.error('[chat-bot] session create failed', sessionErr);
        return jsonResponse({ error: 'session_create_failed' }, 500);
      }
      sessionId = newSession.id;
    } else {
      // Session belongs to user check (RLS ile zaten korumalı ama defensive)
      const { data: sessionRow } = await supabase
        .from('chat_sessions')
        .select('id')
        .eq('id', sessionId)
        .maybeSingle();
      if (!sessionRow) {
        return jsonResponse({ error: 'session_not_found' }, 404);
      }
    }

    // 5. History (last 10 messages, oldest first for context)
    const { data: historyRaw } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(10);
    const history = (historyRaw ?? []).reverse() as Array<{ role: string; content: string }>;

    // 6. KB chunks (semantic vector RAG — V0.3)
    const kbChunks = await searchKB(supabase, body.message, 3);

    // 7. Insert user message
    await supabase.from('chat_messages').insert({
      session_id: sessionId,
      user_id: user.id,
      role: 'user',
      content: body.message,
    });

    // 8. AI call with failover
    const systemPrompt = buildSystemPrompt(profile?.role ?? 'driver', profile?.full_name ?? null, kbChunks);
    const start = Date.now();
    let aiResult: { text: string; provider: string; toolCalls: string[] };

    try {
      // Function calling: tool use loop may take longer than text-only → 12s budget.
      const out = await raceWithTimeout(
        callGemini(systemPrompt, history, body.message, supabase),
        12000,
      );
      aiResult = { text: out.text, provider: 'gemini', toolCalls: out.toolCalls };
    } catch (e1) {
      console.warn('[chat-bot] gemini failed:', (e1 as Error).message);
      try {
        const text = await raceWithTimeout(callCloudflare(systemPrompt, history, body.message), 5000);
        aiResult = { text, provider: 'cloudflare', toolCalls: [] };
      } catch (e2) {
        console.warn('[chat-bot] cloudflare also failed:', (e2 as Error).message);
        aiResult = {
          text:
            'Üzgünüm, şu anda cevap üretemiyorum. Sorunun devam ederse Hesap → Destek menüsünden bize yazabilirsin. Hemen yanıtlamak için tekrar denemek ister misin?',
          provider: 'hardcoded',
          toolCalls: [],
        };
      }
    }

    // 9. Insert assistant message
    await supabase.from('chat_messages').insert({
      session_id: sessionId,
      user_id: user.id,
      role: 'assistant',
      content: aiResult.text,
      metadata: {
        provider: aiResult.provider,
        latency_ms: Date.now() - start,
        tool_calls: aiResult.toolCalls,
        kb_hits: kbChunks.length,
      },
    });

    return jsonResponse({
      sessionId,
      reply: aiResult.text,
      provider: aiResult.provider,
      toolCalls: aiResult.toolCalls,
      kbHits: kbChunks.length,
    }, 200);
  } catch (e) {
    console.error('[chat-bot] unhandled error:', e);
    return jsonResponse({ error: 'internal_error' }, 500);
  }
});

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function raceWithTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

function buildSystemPrompt(role: string, fullName: string | null, kbChunks: string[]): string {
  const userIntro = fullName ? `${fullName} (${role})` : `Kullanıcı (${role})`;
  return `Sen DriverMesh Fleet uygulamasının AI yardım asistanısın.
Türkçe ve İngilizce konuşabilirsin — kullanıcının dilini takip et.

Kullanıcı: ${userIntro}

Tavır:
- Kısa, net, kibar ol.
- Adım adım talimat ver (madde işaretleriyle).
- Sadece aşağıdaki bilgi parçacıklarına veya araç (tool) sonuçlarına dayanan doğru bilgi ver.
- Eğer cevabı bilmiyorsan veya bilgi parçacıkları yetersizse: "Bu konuda kesin bilgim yok; Hesap → Destek formundan ekibe yazabilirsin" de.
- Asla uydurma; hayali fonksiyon/menü isimleri kullanma.

Araç (function) kullanımı:
- Kullanıcı filo durumu, açık iş sayısı, bakımdaki araçlar gibi GÜNCEL veri sorduğunda uygun aracı çağır (get_fleet_stats, list_open_jobs, list_vehicles_in_maintenance).
- Araç sonucunu kullanıcıya doğal dilde özetle (ham JSON gösterme).
- Araç çağırmadan tahmin yapma — veri sorusu varsa önce ilgili aracı kullan.
- Eğer aracın döndürdüğü liste boşsa "Şu an X yok" tarzı net cevap ver.

Kullanıcının rolüne göre yetkilerini hatırla:
- owner: tüm yetkiler
- manager: çoğu yetki var, kritik işlemler (silme, iptal, ekipten çıkarma) için owner gerek
- driver: araç görme, iş görme, kendi aracını üzerine alma, bakım talebi açma

İlgili bilgi parçacıkları:
${kbChunks.length > 0 ? kbChunks.map((c, i) => `\n[Bilgi ${i + 1}]\n${c}`).join('\n') : '(Eşleşen bilgi yok — genel bilgi vermeye çalış veya destek formuna yönlendir)'}`;
}
