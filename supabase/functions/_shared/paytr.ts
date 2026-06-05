// PayTR iframe API — token üretimi + callback (webhook) hash doğrulama.
// Docs: https://dev.paytr.com/iframe-api
// NOT: Gerçek key'ler (PAYTR_MERCHANT_ID/KEY/SALT) gelince test edilmeli.
//      PAYMENTS_SANDBOX=true iken bu yol HİÇ çalışmaz (sandbox devreye girer).

async function hmacSha256Base64(key: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export interface PayTRConfig {
  merchantId: string;
  merchantKey: string;
  merchantSalt: string;
}

export function payTRConfig(): PayTRConfig | null {
  const merchantId = Deno.env.get('PAYTR_MERCHANT_ID');
  const merchantKey = Deno.env.get('PAYTR_MERCHANT_KEY');
  const merchantSalt = Deno.env.get('PAYTR_MERCHANT_SALT');
  if (!merchantId || !merchantKey || !merchantSalt) return null;
  return { merchantId, merchantKey, merchantSalt };
}

/** PayTR get-token → ödeme iframe URL'i döner. */
export async function createPayTRToken(opts: {
  cfg: PayTRConfig;
  merchantOid: string; // benzersiz sipariş no (yalnızca harf+rakam)
  email: string;
  amountKurus: number; // TL * 100 (tamsayı)
  userIp: string;
  userName: string;
  basketLabel: string;
  okUrl: string;
  failUrl: string;
  testMode?: boolean;
}): Promise<{ token: string; iframeUrl: string }> {
  const { cfg } = opts;
  const userBasket = btoa(
    JSON.stringify([[opts.basketLabel, (opts.amountKurus / 100).toFixed(2), 1]]),
  );
  const noInstallment = '0';
  const maxInstallment = '0';
  const currency = 'TL';
  const testMode = opts.testMode ? '1' : '0';

  // hash_str = merchant_id + user_ip + merchant_oid + email + payment_amount
  //          + user_basket + no_installment + max_installment + currency + test_mode
  const hashStr =
    `${cfg.merchantId}${opts.userIp}${opts.merchantOid}${opts.email}${opts.amountKurus}` +
    `${userBasket}${noInstallment}${maxInstallment}${currency}${testMode}`;
  const paytrToken = await hmacSha256Base64(cfg.merchantKey, hashStr + cfg.merchantSalt);

  const form = new URLSearchParams({
    merchant_id: cfg.merchantId,
    user_ip: opts.userIp,
    merchant_oid: opts.merchantOid,
    email: opts.email,
    payment_amount: String(opts.amountKurus),
    paytr_token: paytrToken,
    user_basket: userBasket,
    debug_on: '1',
    no_installment: noInstallment,
    max_installment: maxInstallment,
    user_name: opts.userName,
    user_address: '-',
    user_phone: '-',
    merchant_ok_url: opts.okUrl,
    merchant_fail_url: opts.failUrl,
    timeout_limit: '30',
    currency,
    test_mode: testMode,
  });

  const res = await fetch('https://www.paytr.com/odeme/api/get-token', {
    method: 'POST',
    body: form,
  });
  const data = await res.json();
  if (data.status !== 'success') {
    throw new Error(`paytr_token_failed: ${data.reason ?? 'unknown'}`);
  }
  return { token: data.token as string, iframeUrl: `https://www.paytr.com/odeme/guvenli/${data.token}` };
}

/** Callback (webhook) hash doğrulama — PayTR'nin POST'ladığı hash ile karşılaştırır. */
export async function verifyPayTRCallback(opts: {
  cfg: PayTRConfig;
  merchantOid: string;
  status: string;
  totalAmount: string;
  hash: string;
}): Promise<boolean> {
  const expected = await hmacSha256Base64(
    opts.cfg.merchantKey,
    `${opts.merchantOid}${opts.cfg.merchantSalt}${opts.status}${opts.totalAmount}`,
  );
  return expected === opts.hash;
}
