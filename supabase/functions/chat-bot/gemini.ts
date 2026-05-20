// Google Gemini Flash client — function calling enabled
//
// Endpoint: https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent
// Free tier: 15 RPM, 1500 RPD, 1M tokens/day
// Auth: API key (query string)
//
// V0.2 (2026-05-20): tool use loop — model functionCall donerse executor
// cagrilir, functionResponse part'i geri yollanir, max 3 round loop.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { TOOL_DECLARATIONS, executeTool } from './tools.ts';

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const MAX_TOOL_ROUNDS = 3;

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

interface GeminiRequest {
  systemInstruction?: { parts: Array<{ text: string }> };
  contents: GeminiContent[];
  tools?: Array<{ functionDeclarations: typeof TOOL_DECLARATIONS }>;
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
  };
  safetySettings?: Array<{ category: string; threshold: string }>;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[]; role?: string };
    finishReason?: string;
  }>;
  error?: { code: number; message: string };
}

export async function callGemini(
  systemPrompt: string,
  history: Array<{ role: string; content: string }>,
  userMessage: string,
  supabase?: SupabaseClient,
): Promise<{ text: string; toolCalls: string[] }> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const contents: GeminiContent[] = history.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  contents.push({ role: 'user', parts: [{ text: userMessage }] });

  const baseRequest: Omit<GeminiRequest, 'contents'> = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    tools: supabase ? [{ functionDeclarations: TOOL_DECLARATIONS }] : undefined,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 800,
      topP: 0.9,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    ],
  };

  const toolCalls: string[] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...baseRequest, contents } satisfies GeminiRequest),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`gemini http ${response.status}: ${errText.slice(0, 200)}`);
    }

    const data = (await response.json()) as GeminiResponse;
    if (data.error) {
      throw new Error(`gemini api: ${data.error.message}`);
    }

    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    if (parts.length === 0) {
      throw new Error('gemini: empty response');
    }

    // Tool call yoksa — final cevap
    const functionCalls = parts.filter((p) => p.functionCall);
    if (functionCalls.length === 0) {
      const text = parts
        .map((p) => p.text ?? '')
        .filter((t) => t.length > 0)
        .join('\n')
        .trim();
      if (text.length === 0) {
        throw new Error('gemini: no text in final response');
      }
      return { text, toolCalls };
    }

    if (!supabase) {
      // Tool cagirisi var ama executor verilmemis — text fallback
      throw new Error('gemini requested tools but no supabase client provided');
    }

    // Tool call'lari calistir, response'lari ekle, donguye devam
    contents.push({ role: 'model', parts });
    const responseParts: GeminiPart[] = [];
    for (const p of functionCalls) {
      if (!p.functionCall) continue;
      toolCalls.push(p.functionCall.name);
      const result = await executeTool(supabase, p.functionCall.name, p.functionCall.args ?? {});
      responseParts.push({
        functionResponse: {
          name: p.functionCall.name,
          response: { result } as Record<string, unknown>,
        },
      });
    }
    contents.push({ role: 'user', parts: responseParts });
  }

  throw new Error(`gemini: max tool rounds (${MAX_TOOL_ROUNDS}) exceeded`);
}
