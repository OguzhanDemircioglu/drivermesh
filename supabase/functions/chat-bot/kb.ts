// Knowledge Base — semantic search via pgvector + Gemini embeddings (V0.3)
//
// Eski (V0.1): inline KB chunks + keyword tokenize/score.
// Yeni (V0.3): query'i Gemini text-embedding-004 (768d) ile embed et,
// kb_chunks tablosunda cosine similarity ile en yakın N chunk'i çek.
// Ingest: scripts/ingest_kb_embeddings.py (one-shot, KB güncellenince re-run).

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

const GEMINI_EMBED_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent';

interface EmbedResponse {
  embedding?: { values?: number[] };
  error?: { code: number; message: string };
}

async function embedQuery(apiKey: string, text: string): Promise<number[]> {
  const body = {
    content: { parts: [{ text }] },
    taskType: 'RETRIEVAL_QUERY',
    outputDimensionality: 768,
  };
  const res = await fetch(`${GEMINI_EMBED_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`gemini embed http ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = (await res.json()) as EmbedResponse;
  if (data.error) throw new Error(`gemini embed: ${data.error.message}`);
  const values = data.embedding?.values;
  if (!Array.isArray(values) || values.length !== 768) {
    throw new Error(`gemini embed: unexpected shape ${values?.length ?? 'null'}`);
  }
  return values;
}

interface KBChunkRow {
  source: string;
  heading: string;
  content: string;
  similarity: number;
}

/**
 * Semantic KB search. Query → embedding → `search_kb_chunks` RPC.
 * Returns top-k chunks formatted same as legacy keyword search (string array
 * each prefixed with "# source — heading\n...content").
 *
 * Fail-safe: embedding API timeout/fail veya RPC empty → boş array dön.
 * Caller (index.ts) bu durumda KB-only chunks olmadan da Gemini'ye query
 * yollar; bot yine cevap üretir, sadece KB referansı yok.
 */
export async function searchKB(
  supabase: SupabaseClient,
  query: string,
  k = 3,
): Promise<string[]> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    console.warn('[kb] GEMINI_API_KEY missing — KB search disabled');
    return [];
  }

  try {
    const embedding = await embedQuery(apiKey, query);
    // pgvector adapter: PostgREST kabul ettiği format `[a,b,c]` string.
    const embeddingStr = '[' + embedding.join(',') + ']';

    const { data, error } = await supabase.rpc('search_kb_chunks', {
      p_query_embedding: embeddingStr,
      p_match_count: k,
    });

    if (error) {
      console.warn('[kb] rpc error:', error.message);
      return [];
    }

    const rows = (data ?? []) as KBChunkRow[];
    return rows.map((r) => `# ${r.source} — ${r.heading}\n${r.content}`);
  } catch (e) {
    console.warn('[kb] search failed:', (e as Error).message);
    return [];
  }
}
