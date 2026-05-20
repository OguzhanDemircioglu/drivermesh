"""Dump all supabase_migrations.schema_migrations rows as individual .sql files
under supabase/migrations/. One-shot baseline extraction.

Usage:
  export DB_PASS=$(grep '^LOCAL_DB_PASSWORD=' fleet/.env | cut -d= -f2-)
  python scripts/dump_migrations.py
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

try:
    import psycopg2
except ImportError:
    print("psycopg2 missing. Run: python -m pip install --user psycopg2-binary", file=sys.stderr)
    sys.exit(1)

PROJECT_REF = "ucitxvsndlwvvnqwabgo"
MIGRATIONS_DIR = Path("supabase/migrations")


def sanitize(name: str) -> str:
    return re.sub(r"[^a-z0-9_]", "_", name.lower())


def main() -> int:
    pw = os.environ.get("DB_PASS") or os.environ.get("SUPABASE_DB_PASSWORD")
    if not pw:
        print("DB_PASS not set", file=sys.stderr)
        return 2

    MIGRATIONS_DIR.mkdir(parents=True, exist_ok=True)

    # Try pooler (session mode :5432) with project-prefixed user, then direct.
    candidates = [
        f"postgresql://postgres.{PROJECT_REF}:{pw}@aws-1-eu-central-1.pooler.supabase.com:5432/postgres",
        f"postgresql://postgres.{PROJECT_REF}:{pw}@aws-1-eu-central-1.pooler.supabase.com:6543/postgres",
        f"postgresql://postgres.{PROJECT_REF}:{pw}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres",
        f"postgresql://postgres.{PROJECT_REF}:{pw}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres",
    ]
    conn = None
    last_err: Exception | None = None
    for dsn in candidates:
        try:
            conn = psycopg2.connect(dsn, connect_timeout=15)
            print(f"connected via {dsn.split('@')[1]}")
            break
        except Exception as e:
            last_err = e
            print(f"  failed {dsn.split('@')[1]}: {str(e).strip()[:120]}", file=sys.stderr)
    if conn is None:
        raise SystemExit(f"all connection attempts failed: {last_err}")
    cur = conn.cursor()
    cur.execute(
        """
        SELECT version, name, statements
        FROM supabase_migrations.schema_migrations
        ORDER BY version
        """
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()

    print(f"fetched {len(rows)} migrations")
    for version, name, statements in rows:
        fp = MIGRATIONS_DIR / f"{version}_{sanitize(name)}.sql"
        body = ";\n".join(statements).rstrip() + ";\n"
        fp.write_text(body, encoding="utf-8")
        print(f"wrote {fp} ({len(body)} bytes)")

    return 0


if __name__ == "__main__":
    sys.exit(main())
