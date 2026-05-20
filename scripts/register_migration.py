"""Register manually-applied migration(s) into supabase_migrations.schema_migrations.

When a migration was applied via Dashboard SQL Editor (not via supabase CLI),
schema_migrations table doesn't have a row for it. This script inserts the
matching row(s) so CLI sees them as already applied.

Modes:
  Single (legacy):
    python scripts/register_migration.py <version> <name> <path-to-sql>

  Auto-sync (preferred):
    python scripts/register_migration.py --sync
        # Scans supabase/migrations/*.sql, compares against schema_migrations,
        # registers everything missing. Idempotent — safe to re-run.

  Dry run:
    python scripts/register_migration.py --sync --dry-run

Filename convention: `<version>_<snake_case_name>.sql` where version is the
14-digit timestamp prefix (YYYYMMDDHHMMSS).

Env: DB_PASS or SUPABASE_DB_PASSWORD.
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path
from typing import Iterable

import psycopg2  # type: ignore

PROJECT_REF = "ucitxvsndlwvvnqwabgo"
MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "supabase" / "migrations"
FILENAME_RE = re.compile(r"^(\d{14})_(.+)\.sql$")


def _dsn() -> str:
    pw = os.environ.get("DB_PASS") or os.environ.get("SUPABASE_DB_PASSWORD")
    if not pw:
        raise RuntimeError("DB_PASS or SUPABASE_DB_PASSWORD not set")
    return (
        f"postgresql://postgres.{PROJECT_REF}:{pw}"
        f"@aws-1-eu-central-1.pooler.supabase.com:5432/postgres"
    )


def _register_one(cur, version: str, name: str, sql_text: str) -> None:
    cur.execute(
        """
        INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
        VALUES (%s, %s, ARRAY[%s]::text[])
        ON CONFLICT (version) DO UPDATE
          SET name = EXCLUDED.name, statements = EXCLUDED.statements
        """,
        (version, name, sql_text),
    )


def _applied_versions(cur) -> set[str]:
    cur.execute("SELECT version FROM supabase_migrations.schema_migrations")
    return {row[0] for row in cur.fetchall()}


def _local_migrations() -> Iterable[tuple[str, str, Path]]:
    """Yield (version, name, path) for each file matching the convention."""
    if not MIGRATIONS_DIR.is_dir():
        raise RuntimeError(f"migrations dir not found: {MIGRATIONS_DIR}")
    for p in sorted(MIGRATIONS_DIR.glob("*.sql")):
        m = FILENAME_RE.match(p.name)
        if not m:
            print(f"skip (bad filename): {p.name}", file=sys.stderr)
            continue
        yield m.group(1), m.group(2), p


def cmd_sync(dry_run: bool) -> int:
    conn = psycopg2.connect(_dsn(), connect_timeout=15)
    conn.autocommit = True
    try:
        cur = conn.cursor()
        applied = _applied_versions(cur)
        missing = [(v, n, p) for v, n, p in _local_migrations() if v not in applied]
        if not missing:
            print(f"all {len(applied)} local migrations already registered")
            return 0
        print(f"missing {len(missing)} migrations (of {len(list(_local_migrations()))} local files):")
        for v, n, _ in missing:
            print(f"  - {v}_{n}")
        if dry_run:
            print("dry-run: no changes applied")
            return 0
        for v, n, p in missing:
            _register_one(cur, v, n, p.read_text(encoding="utf-8"))
            print(f"  registered {v}_{n}")
        return 0
    finally:
        conn.close()


def cmd_single(version: str, name: str, sql_path: Path) -> int:
    conn = psycopg2.connect(_dsn(), connect_timeout=15)
    conn.autocommit = True
    try:
        cur = conn.cursor()
        _register_one(cur, version, name, sql_path.read_text(encoding="utf-8"))
        print(f"registered {version}_{name}")
        return 0
    finally:
        conn.close()


def main() -> int:
    args = sys.argv[1:]
    if not args:
        print(__doc__, file=sys.stderr)
        return 2

    if args[0] == "--sync":
        dry = "--dry-run" in args[1:]
        return cmd_sync(dry_run=dry)

    if len(args) == 3:
        return cmd_single(args[0], args[1], Path(args[2]))

    print(__doc__, file=sys.stderr)
    return 2


if __name__ == "__main__":
    try:
        sys.exit(main())
    except RuntimeError as e:
        print(f"error: {e}", file=sys.stderr)
        sys.exit(2)
