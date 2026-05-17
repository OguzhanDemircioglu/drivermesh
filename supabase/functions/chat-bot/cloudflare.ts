// Cloudflare Workers AI client — Llama 3.1 8B (fallback)
//
// Endpoint: https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/@cf/meta/llama-3.1-8b-instruct
// Free tier: 10K requests/day
// Auth: Bearer token

interface CFMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface CFRequest {
  messages: CFMessage[];
  max_tokens?: number;
  temperature?: number;
}

interface CFResponse {
  result?: { response?: string };
  success?: boolean;
  errors?: Array<{ code: number; message: string }>;
}

export async function callCloudflare(
  systemPrompt: string,
  history: Array<{ role: string; content: string }>,
  userMessage: string,
): Promise<string> {
  const accountId = Deno.env.get('CF_ACCOUNT_ID');
  const apiToken = Deno.env.get('CF_API_TOKEN');
  if (!accountId || !apiToken) {
    throw new Error('CF_ACCOUNT_ID or CF_API_TOKEN not configured');
  }

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.1-8b-instruct`;

  // CF messages format: system + alternating user/assistant + final user
  const messages: CFMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history.map((m) => ({
      role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: m.content,
    })),
    { role: 'user', content: userMessage },
  ];

  const body: CFRequest = {
    messages,
    max_tokens: 800,
    temperature: 0.7,
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`cloudflare http ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = (await response.json()) as CFResponse;
  if (!data.success && data.errors?.length) {
    throw new Error(`cloudflare api: ${data.errors[0].message}`);
  }

  const text = data.result?.response;
  if (!text || text.trim().length === 0) {
    throw new Error('cloudflare: empty response');
  }

  return text.trim();
}
