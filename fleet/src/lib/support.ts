import { isDemoActive } from '@/demo/store';
import { supabase } from '@/lib/supabase';

/**
 * In-app destek formundan gelen mesajlari Supabase Edge Function uzerinden
 * Telegram bot'una iletir. Demo modda hicbir sekilde cagrilmaz (UI butonu
 * zaten disable, bu fonksiyonun guard'i backstop).
 *
 * **Guvenlik:** Onceden token client bundle'da idi (EXPO_PUBLIC_*) -> APK
 * decompile token leak. v2'de tum cagri sunucu tarafina (`send-support-message`
 * edge fn) tasindi. Token Supabase Edge Function Secrets'ta
 * (TELEGRAM_SUPPORT_BOT_TOKEN + TELEGRAM_SUPPORT_CHAT_ID), client'tan asla
 * gorunmez. Edge fn verify_jwt:true ile sadece authenticated kullanici
 * cagirabilir.
 */

const BOT_USERNAME = process.env.EXPO_PUBLIC_TELEGRAM_SUPPORT_USERNAME;

export type SupportMessageInput = {
  text: string;
  userName: string;
  userEmail: string;
  userRole: string;
};

export class SupportError extends Error {
  code: 'demo_disabled' | 'unauthenticated' | 'network' | 'telegram' | 'config';
  constructor(code: SupportError['code'], message: string) {
    super(message);
    this.code = code;
  }
}

export function isSupportConfigured(): boolean {
  // Edge fn deploy + Edge Function Secrets dashboard'tan eklenince
  // server-side hazir; client tarafinda her zaman true (gercek health
  // check sendSupportMessage cagrisinda olur).
  return true;
}

export function getSupportBotUsername(): string | null {
  return BOT_USERNAME ?? null;
}

export async function sendSupportMessage(input: SupportMessageInput): Promise<void> {
  if (isDemoActive()) {
    throw new SupportError('demo_disabled', 'Support disabled in demo mode');
  }
  const trimmed = input.text.trim();
  if (!trimmed) {
    throw new SupportError('telegram', 'Empty message');
  }

  const { data, error } = await supabase.functions.invoke('send-support-message', {
    body: {
      text: trimmed,
      userName: input.userName,
      userEmail: input.userEmail,
      userRole: input.userRole,
    },
  });

  if (error) {
    // Network / 401 / 500 — supabase-js wraps fetch error
    const msg = error.message || 'invoke failed';
    if (msg.toLowerCase().includes('jwt') || msg.toLowerCase().includes('unauthor')) {
      throw new SupportError('unauthenticated', msg);
    }
    throw new SupportError('network', msg);
  }

  // Edge fn returns { ok: true } on success or { error: '...' } on app error
  const payload = data as { ok?: boolean; error?: string };
  if (!payload?.ok) {
    const detail = payload?.error ?? 'unknown';
    if (detail.includes('missing in Edge Function Secrets')) {
      throw new SupportError(
        'config',
        'Sunucu yapilandirmasi eksik (Edge Function Secrets).',
      );
    }
    throw new SupportError('telegram', detail);
  }
}
