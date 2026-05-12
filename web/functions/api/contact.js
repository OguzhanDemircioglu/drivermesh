// Cloudflare Pages Function — POST /api/contact
// Landing contact form → Telegram Bot API sendMessage.
// Plain JS (no TS) to avoid build edge cases.

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5;
const ipHits = new Map();

function rateLimit(ip) {
  const now = Date.now();
  const arr = (ipHits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) {
    ipHits.set(ip, arr);
    return false;
  }
  arr.push(now);
  ipHits.set(ip, arr);
  return true;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function trim(s, max = 2000) {
  const t = (typeof s === 'string' ? s : '').trim();
  return t.length > max ? t.slice(0, max) + '…' : t;
}

function jsonError(status, code) {
  return new Response(JSON.stringify({ ok: false, error: code }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function onRequestPost({ request, env }) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return jsonError(500, 'server_misconfigured');
  }

  const ip =
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
    'unknown';
  if (!rateLimit(ip)) return jsonError(429, 'rate_limited');

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, 'invalid_json');
  }

  // Honeypot — silent success
  if (typeof body.website === 'string' && body.website.length > 0) {
    return Response.json({ ok: true });
  }

  const name = trim(body.name, 120);
  const email = trim(body.email, 120);
  const subject = trim(body.subject, 160);
  const message = trim(body.message, 2000);
  const lang = trim(body.lang, 8) || 'tr';
  const page = trim(body.page, 240);
  const ua = trim(body.ua, 300);

  if (!name || !email || !message) return jsonError(400, 'missing_required');
  if (!EMAIL_RE.test(email)) return jsonError(400, 'invalid_email');

  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const text = [
    `🚐 <b>DriverMesh — Yeni İletişim</b>`,
    ``,
    `👤 <b>Ad:</b> ${esc(name)}`,
    `✉️ <b>E-posta:</b> ${esc(email)}`,
    subject ? `📌 <b>Konu:</b> ${esc(subject)}` : '',
    ``,
    `💬 <b>Mesaj:</b>`,
    esc(message),
    ``,
    `🌐 <i>${esc(lang)} · ${esc(page)}</i>`,
    `🕐 <i>${ts} · IP: ${esc(ip)}</i>`,
    ua ? `🖥 <i>${esc(ua)}</i>` : '',
  ].filter(Boolean).join('\n');

  const tgUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const tgRes = await fetch(tgUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  if (!tgRes.ok) {
    const errBody = await tgRes.text().catch(() => '');
    console.warn('[contact] telegram api failed', tgRes.status, errBody.slice(0, 200));
    return jsonError(502, 'telegram_failed');
  }

  return Response.json({ ok: true });
}
