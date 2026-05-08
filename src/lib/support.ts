import { isDemoActive } from '@/demo/store';

/**
 * In-app destek formundan gelen mesajları Telegram bot üzerinden admin
 * chat'e iletir. Demo modda hiçbir şekilde çağrılmaz (UI butonu zaten
 * disable, bu fonksiyonun guard'ı backstop).
 *
 * **Güvenlik notu:** EXPO_PUBLIC_TELEGRAM_SUPPORT_API_KEY client bundle'a
 * embed edilir → APK decompile edilirse herkes tarafından okunabilir.
 * Üretim öncesi mesaj gönderme bir backend RPC'ye (Supabase Edge Function)
 * taşınmalı. RPC sunucu tarafında token'ı tutar, client sadece authorized
 * kullanıcı çağırabilir.
 */

const BOT_TOKEN = process.env.EXPO_PUBLIC_TELEGRAM_SUPPORT_API_KEY;
const ADMIN_CHAT_ID = process.env.EXPO_PUBLIC_TELEGRAM_SUPPORT_CHAT_ID;
const BOT_USERNAME = process.env.EXPO_PUBLIC_TELEGRAM_SUPPORT_USERNAME;

export type SupportMessageInput = {
  text: string;
  userName: string;
  userEmail: string;
  userRole: string;
};

export class SupportError extends Error {
  code: 'demo_disabled' | 'env_missing' | 'network' | 'telegram';
  constructor(code: SupportError['code'], message: string) {
    super(message);
    this.code = code;
  }
}

export function isSupportConfigured(): boolean {
  return !!(BOT_TOKEN && ADMIN_CHAT_ID);
}

export function getSupportBotUsername(): string | null {
  return BOT_USERNAME ?? null;
}

export async function sendSupportMessage(input: SupportMessageInput): Promise<void> {
  if (isDemoActive()) {
    throw new SupportError('demo_disabled', 'Support disabled in demo mode');
  }
  if (!BOT_TOKEN || !ADMIN_CHAT_ID) {
    throw new SupportError(
      'env_missing',
      'EXPO_PUBLIC_TELEGRAM_SUPPORT_API_KEY/CHAT_ID is not set',
    );
  }
  const trimmed = input.text.trim();
  if (!trimmed) {
    throw new SupportError('telegram', 'Empty message');
  }

  const body = [
    '📩 *Yeni destek talebi*',
    '',
    `👤 ${input.userName} _(${input.userRole})_`,
    `✉️ ${input.userEmail}`,
    '',
    trimmed,
  ].join('\n');

  let res: Response;
  try {
    res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: ADMIN_CHAT_ID,
        text: body,
        parse_mode: 'Markdown',
      }),
    });
  } catch (e) {
    throw new SupportError('network', (e as Error).message || 'Network error');
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new SupportError('telegram', `${res.status} ${detail.slice(0, 200)}`);
  }
}
