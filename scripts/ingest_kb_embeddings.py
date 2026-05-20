"""Ingest docs/help/*.md as KB chunks with Gemini text-embedding-004 vectors.

Pipeline:
  1. Parse each .md file → split into ## sections (heading + content).
  2. For each chunk, call Gemini embedContent API → 768-dim vector.
  3. UPSERT into public.kb_chunks (RLS bypassed via service_role connection).

One-shot run. Re-run safe (UNIQUE (source, heading) ON CONFLICT update).

Env:
  SUPABASE_DB_PASSWORD  (fleet/.env)
  GEMINI_API_KEY        (fleet/.env or Supabase secrets)

Usage:
  python scripts/ingest_kb_embeddings.py
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

try:
    import psycopg2
    from psycopg2.extras import execute_values
except ImportError:
    print("psycopg2 missing. Run: python -m pip install --user psycopg2-binary", file=sys.stderr)
    sys.exit(1)

PROJECT_REF = "ucitxvsndlwvvnqwabgo"
GEMINI_EMBED_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent"
)
KB_DIR = Path("docs/help")
RATE_LIMIT_DELAY_S = 1.0  # Gemini free tier ~15 RPM; sleep between calls


def parse_markdown_chunks(text: str, source: str) -> list[dict]:
    """Split on ## headings. Returns [{source, heading, content}]."""
    chunks: list[dict] = []
    current_heading: str | None = None
    current_lines: list[str] = []

    for line in text.splitlines():
        m = re.match(r"^##\s+(.+?)\s*$", line)
        if m:
            if current_heading and current_lines:
                content = "\n".join(current_lines).strip()
                if content:
                    chunks.append(
                        {"source": source, "heading": current_heading, "content": content}
                    )
            current_heading = m.group(1).strip()
            current_lines = []
        else:
            if current_heading is not None:
                current_lines.append(line)

    if current_heading and current_lines:
        content = "\n".join(current_lines).strip()
        if content:
            chunks.append({"source": source, "heading": current_heading, "content": content})

    return chunks


def gemini_embed(api_key: str, text: str) -> list[float]:
    body = {
        "model": "models/text-embedding-004",
        "content": {"parts": [{"text": text}]},
        "taskType": "RETRIEVAL_DOCUMENT",
    }
    req = urllib.request.Request(
        f"{GEMINI_EMBED_URL}?key={api_key}",
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.load(r)
    values = data.get("embedding", {}).get("values")
    if not isinstance(values, list) or len(values) != 768:
        raise RuntimeError(f"Unexpected embedding shape: {len(values) if values else None}")
    return values


def main() -> int:
    pw = os.environ.get("DB_PASS") or os.environ.get("SUPABASE_DB_PASSWORD")
    api_key = os.environ.get("GEMINI_API_KEY")
    if not pw:
        print("Missing DB_PASS / SUPABASE_DB_PASSWORD env", file=sys.stderr)
        return 2
    if not api_key:
        print("Missing GEMINI_API_KEY env", file=sys.stderr)
        return 2

    # Gather all chunks
    chunks: list[dict] = []
    for p in sorted(KB_DIR.glob("*.md")):
        chunks.extend(parse_markdown_chunks(p.read_text(encoding="utf-8"), p.name))
    if not chunks:
        print(f"No chunks found in {KB_DIR}", file=sys.stderr)
        return 1
    print(f"parsed {len(chunks)} chunks from {KB_DIR}")

    # Embed each (rate-limited)
    rows: list[tuple] = []
    for i, c in enumerate(chunks, 1):
        text = f"{c['heading']}\n{c['content']}"
        try:
            emb = gemini_embed(api_key, text)
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")[:200]
            print(f"  [{i}/{len(chunks)}] HTTP {e.code} on {c['source']}—{c['heading']}: {body}", file=sys.stderr)
            return 1
        rows.append((c["source"], c["heading"], c["content"], emb, len(text)))
        print(f"  [{i}/{len(chunks)}] embedded: {c['source']} — {c['heading'][:50]}")
        if i < len(chunks):
            time.sleep(RATE_LIMIT_DELAY_S)

    # UPSERT into DB
    dsn = (
        f"postgresql://postgres.{PROJECT_REF}:{pw}@aws-1-eu-central-1.pooler.supabase.com:5432/postgres"
    )
    conn = psycopg2.connect(dsn, connect_timeout=15)
    conn.autocommit = False
    cur = conn.cursor()
    # pgvector adapter: pass as string '[a,b,c]'
    formatted_rows = [
        (
            r[0],
            r[1],
            r[2],
            "[" + ",".join(str(x) for x in r[3]) + "]",
            r[4],
        )
        for r in rows
    ]
    execute_values(
        cur,
        """
        INSERT INTO public.kb_chunks (source, heading, content, embedding, token_count)
        VALUES %s
        ON CONFLICT (source, heading) DO UPDATE SET
          content = EXCLUDED.content,
          embedding = EXCLUDED.embedding,
          token_count = EXCLUDED.token_count
        """,
        formatted_rows,
        template="(%s, %s, %s, %s::vector, %s)",
    )
    conn.commit()
    cur.close()
    conn.close()
    print(f"upserted {len(rows)} chunks")
    return 0


if __name__ == "__main__":
    sys.exit(main())
