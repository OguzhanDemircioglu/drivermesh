"""Register a manually-applied migration into supabase_migrations.schema_migrations.

When a migration was applied via Dashboard SQL Editor (not via supabase CLI),
schema_migrations table doesn't have a row for it. This script reads a local
.sql file and inserts the matching row so CLI sees it as already applied.

Usage:
  export DB_PASS=$(grep '^SUPABASE_DB_PASSWORD=' fleet/.env | cut -d= -f2-)
  python scripts/register_migration.py <version> <name> <path-to-sql>

Example:
  python scripts/register_migration.py 20260520120000 \
      hierarchy_phase2_manager_scope_rls \
      supabase/migrations/20260520120000_hierarchy_phase2_manager_scope_rls.sql
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import psycopg2  # type: ignore

PROJECT_REF = "ucitxvsndlwvvnqwabgo"


def main() -> int:
    if len(sys.argv) != 4:
        print(__doc__, file=sys.stderr)
        return 2
    version, name, sql_path = sys.argv[1], sys.argv[2], Path(sys.argv[3])

    pw = os.environ.get("DB_PASS") or os.environ.get("SUPABASE_DB_PASSWORD")
    if not pw:
        print("DB_PASS not set", file=sys.stderr)
        return 2

    sql_text = sql_path.read_text(encoding="utf-8")

    dsn = f"postgresql://postgres.{PROJECT_REF}:{pw}@aws-1-eu-central-1.pooler.supabase.com:5432/postgres"
    conn = psycopg2.connect(dsn, connect_timeout=15)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
        VALUES (%s, %s, ARRAY[%s]::text[])
        ON CONFLICT (version) DO UPDATE SET name = EXCLUDED.name, statements = EXCLUDED.statements
        """,
        (version, name, sql_text),
    )
    cur.close()
    conn.close()
    print(f"registered {version}_{name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
