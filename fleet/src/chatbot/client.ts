// Chatbot client — Supabase Edge Function fetch wrapper
//
// Sends messages to /functions/v1/chat-bot, persists sessions+messages
// in chat_sessions / chat_messages tables (RLS-protected).
//
// Client-side timeout: 15s (edge function içinde 5s timeout var ama
// network gecikmesi olabilir). Hata olursa "müşteriyi cevapsız bırakma"
// kuralı gereği hardcoded fallback mesaj döner.

import { supabase } from '@/lib/supabase';
import { isDemoActive } from '@/demo/store';
import type { ChatBotResponse, ChatMessage, ChatSession } from './types';

const CLIENT_TIMEOUT_MS = 15_000;

const FALLBACK_REPLY =
  'Bağlantıda bir aksaklık oldu. Tekrar denemek ister misin? Sorun devam ederse Hesap → Destek menüsünden bize yazabilirsin.';

const DEMO_REPLY = (msg: string) =>
  `Demo modundasın 👋 — gerçek backend bağlantısı kapalı, sana örnek bir cevap vereyim:\n\n` +
  `Sorduğun konu için temel adımlar:\n` +
  `• İlgili sekmeye git (Filo / İşler / Ekip)\n` +
  `• Sağ üstte "+" veya formdaki alanları doldur\n` +
  `• Kaydet — değişiklik anında uygulanır\n\n` +
  `Gerçek hesabınla giriş yaparsan bot sana adım adım ayrıntılı cevap verir. Şimdi sırasıyla "Devam" diyerek tur'a devam edebilirsin.`;

export async function sendMessage(
  message: string,
  sessionId?: string,
): Promise<ChatBotResponse> {
  // Demo modunda Supabase JWT yok — edge function 401 verir. Hardcoded
  // örnek cevap döndür, kullanıcı yine etkileşim hissi alır.
  if (isDemoActive()) {
    await new Promise((r) => setTimeout(r, 600)); // typing hissi
    return {
      sessionId: sessionId ?? 'demo-session',
      reply: DEMO_REPLY(message),
      provider: 'hardcoded',
    };
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return {
      sessionId: sessionId ?? '',
      reply: FALLBACK_REPLY,
      provider: 'hardcoded',
    };
  }

  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/chat-bot`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ sessionId, message }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.warn('[chatbot] http error', response.status, body.slice(0, 200));
      return {
        sessionId: sessionId ?? '',
        reply: FALLBACK_REPLY,
        provider: 'hardcoded',
      };
    }

    const data = (await response.json()) as ChatBotResponse;
    return data;
  } catch (e) {
    // Network or timeout — return hardcoded reply, never throw upward
    console.warn('[chatbot] fetch failed', (e as Error).message);
    return {
      sessionId: sessionId ?? '',
      reply: FALLBACK_REPLY,
      provider: 'hardcoded',
    };
  } finally {
    clearTimeout(timeout);
  }
}

/** Get most recent session for current user, or create marker for new chat. */
export async function getOrCreateLatestSession(): Promise<ChatSession | null> {
  const { data, error } = await supabase
    .from('chat_sessions')
    .select('*')
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn('[chatbot] session fetch failed', error);
    return null;
  }
  return data as ChatSession | null;
}

/** Fetch messages for a session (RLS ensures own only). */
export async function getMessages(sessionId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  if (error) {
    console.warn('[chatbot] messages fetch failed', error);
    return [];
  }
  return (data ?? []) as ChatMessage[];
}

/** Start a fresh session (clears any current sessionId reference). */
export async function newSession(): Promise<void> {
  // No-op on client side; backend creates session when sendMessage is called
  // with sessionId=undefined. UI just resets local state.
}

/** List recent chat sessions (RLS = own only). Max 30. */
export async function listSessions(): Promise<ChatSession[]> {
  const { data, error } = await supabase
    .from('chat_sessions')
    .select('*')
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(30);
  if (error) {
    console.warn('[chatbot] list sessions failed', error);
    return [];
  }
  return (data ?? []) as ChatSession[];
}
