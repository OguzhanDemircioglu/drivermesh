-- Chatbot KB embedding-based RAG (V0.3)
-- Mevcut keyword search (kb.ts inline + tokenize/score) → semantic vector search.
-- Gemini text-embedding-004 (768 boyut) ile chunk + query embedding.
-- Sonuç: synonym/paraphrase yakalanır, false-negative azalır.

-- 1) Extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2) KB chunks tablosu
CREATE TABLE IF NOT EXISTS public.kb_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  heading text NOT NULL,
  content text NOT NULL,
  embedding vector(768),
  token_count int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, heading)
);

-- 3) HNSW index — cosine distance için en hızlı approximate search
CREATE INDEX IF NOT EXISTS kb_chunks_embedding_hnsw
  ON public.kb_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 4) RLS (kb herkese okuma; yazma sadece service_role)
ALTER TABLE public.kb_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kb_chunks_read_authed ON public.kb_chunks;
CREATE POLICY kb_chunks_read_authed ON public.kb_chunks
  FOR SELECT TO authenticated
  USING (true);

-- INSERT/UPDATE/DELETE: service_role only (RLS bypass with service_role JWT).

-- 5) RPC: en yakın chunk'ları getirir
-- Caller embedding vector + match_count gönderir; security definer çünkü
-- chunk'lar herkese okunabilir (RLS zaten true).
CREATE OR REPLACE FUNCTION public.search_kb_chunks(
  p_query_embedding vector(768),
  p_match_count int DEFAULT 3
)
RETURNS TABLE (
  source text,
  heading text,
  content text,
  similarity float
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT
    source,
    heading,
    content,
    1 - (embedding <=> p_query_embedding) AS similarity
  FROM public.kb_chunks
  WHERE embedding IS NOT NULL
  ORDER BY embedding <=> p_query_embedding
  LIMIT GREATEST(1, LEAST(p_match_count, 10));
$$;

REVOKE EXECUTE ON FUNCTION public.search_kb_chunks(vector, int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.search_kb_chunks(vector, int) TO authenticated;

-- 6) updated_at trigger
CREATE OR REPLACE FUNCTION public.kb_chunks_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS kb_chunks_updated_at_trg ON public.kb_chunks;
CREATE TRIGGER kb_chunks_updated_at_trg
  BEFORE UPDATE ON public.kb_chunks
  FOR EACH ROW EXECUTE FUNCTION public.kb_chunks_set_updated_at();
