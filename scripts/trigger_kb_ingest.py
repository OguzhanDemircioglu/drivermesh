"""Parse docs/help/*.md → chunks → POST to /functions/v1/kb-ingest.
Edge function does the embedding + upsert. Deleted after use.

Usage:
  export SERVICE_ROLE_KEY=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' fleet/.env | cut -d= -f2-)
  python scripts/trigger_kb_ingest.py
"""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

PROJECT_REF = "ucitxvsndlwvvnqwabgo"
KB_DIR = Path("docs/help")


def parse_chunks(text: str, source: str) -> list[dict]:
    chunks: list[dict] = []
    heading = None
    lines: list[str] = []
    for line in text.splitlines():
        m = re.match(r"^##\s+(.+?)\s*$", line)
        if m:
            if heading and lines:
                body = "\n".join(lines).strip()
                if body:
                    chunks.append({"source": source, "heading": heading, "content": body})
            heading = m.group(1).strip()
            lines = []
        elif heading is not None:
            lines.append(line)
    if heading and lines:
        body = "\n".join(lines).strip()
        if body:
            chunks.append({"source": source, "heading": heading, "content": body})
    return chunks


def main() -> int:
    srk = os.environ.get("SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not srk:
        print("Missing SERVICE_ROLE_KEY env", file=sys.stderr)
        return 2

    chunks: list[dict] = []
    for p in sorted(KB_DIR.glob("*.md")):
        chunks.extend(parse_chunks(p.read_text(encoding="utf-8"), p.name))
    if not chunks:
        print("no chunks", file=sys.stderr)
        return 1
    print(f"parsed {len(chunks)} chunks")

    req = urllib.request.Request(
        f"https://{PROJECT_REF}.supabase.co/functions/v1/kb-ingest",
        data=json.dumps({"chunks": chunks}).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {srk}",
            "apikey": srk,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            data = json.load(r)
            print(f"OK: {data}")
            return 0 if data.get("failed", 1) == 0 else 1
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"HTTP {e.code}: {body}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
