"""Generate covering-index migration for FK without index.

Sadece Supabase performance advisor `unindexed_foreign_keys`'in
işaretlediği 42 FK'ye odaklanır — tüm FK'lere index açmak gereksiz
storage + write overhead getirir. Advisor "production'da etki yapacak"
olanları seçer.

Bu script advisor JSON dump'ından (önceden çekilmiş) FK adlarını parse
eder, pg_constraint'ten kolon listesini alır, covering index yoksa
CREATE INDEX IF NOT EXISTS ekler.

Çıktı: supabase/migrations/<ts>_fk_covering_indexes.sql

Önkoşul: advisor JSON dump path argümanı (varsayılan: en güncel
`mcp-...-get_advisors-<ts>.txt` tool-results altında).
"""
from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime, timezone
from glob import glob
from pathlib import Path

import psycopg2  # type: ignore
import psycopg2.extras  # type: ignore

PROJECT_REF = "ucitxvsndlwvvnqwabgo"
ROOT = Path(__file__).resolve().parent.parent
MIGRATIONS_DIR = ROOT / "supabase" / "migrations"

DETAIL_RE = re.compile(
    r"Table\s+\\`([^`]+)\\`\s+has a foreign key\s+\\`([^`]+)\\`"
)


def _dsn() -> str:
    pw = os.environ.get("DB_PASS") or os.environ.get("SUPABASE_DB_PASSWORD")
    if not pw:
        raise RuntimeError("DB_PASS or SUPABASE_DB_PASSWORD not set")
    return (
        f"postgresql://postgres.{PROJECT_REF}:{pw}"
        f"@aws-1-eu-central-1.pooler.supabase.com:5432/postgres"
    )


# Advisor'ın flag'lediği FK adlarına odaklanır; her birinin kolonlarını
# pg_constraint'ten çeker. Tablo adı schema'lı (örn '"filoLocal".jobs').
QUERY = """
WITH targets AS (
  SELECT
    trim(both '"' from split_part(t, '.', 1)) AS raw_schema,
    split_part(t, '.', 2) AS raw_table,
    fk
  FROM unnest(%(tables)s::text[], %(fks)s::text[]) AS u(t, fk)
)
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  con.conname AS fk_name,
  array_agg(att.attname ORDER BY u.ord)::text[] AS fk_columns
FROM targets g
JOIN pg_namespace n ON n.nspname = g.raw_schema
JOIN pg_class c ON c.relname = g.raw_table AND c.relnamespace = n.oid
JOIN pg_constraint con ON con.conrelid = c.oid AND con.conname = g.fk
JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS u(attnum, ord) ON true
JOIN pg_attribute att ON att.attrelid = c.oid AND att.attnum = u.attnum
WHERE con.contype = 'f'
GROUP BY n.nspname, c.relname, con.conname
ORDER BY n.nspname, c.relname, con.conname;
"""


def _parse_advisor_pairs() -> list[list[str]]:
    """Read latest advisor JSON dump, extract (table, fk_name) pairs."""
    pattern = str(
        ROOT.parent.parent
        / "Users" / "oguzh" / ".claude" / "projects"
        / "C--Projeler-drivermesh" / "*" / "tool-results"
        / "mcp-*-get_advisors-*.txt"
    )
    files = sorted(glob(pattern), key=os.path.getmtime)
    if not files:
        # Allow CLI arg fallback
        if len(sys.argv) > 1:
            files = [sys.argv[1]]
        else:
            raise RuntimeError("no advisor dump file found")
    with open(files[-1], "r", encoding="utf-8") as f:
        data = json.load(f)
    lints = data.get("result", {}).get("lints", [])
    pairs: list[list[str]] = []
    for l in lints:
        if l.get("name") != "unindexed_foreign_keys":
            continue
        detail = l.get("detail") or ""
        m = DETAIL_RE.search(detail)
        if m:
            pairs.append([m.group(1), m.group(2)])
    return pairs


def _quote_ident(s: str) -> str:
    return '"' + s.replace('"', '""') + '"'


def _quote_ident_lower_safe(s: str) -> str:
    # idx_name için zaten lowercase + ascii; yine de identifier kuralı.
    return _quote_ident(s)


def build_sql() -> tuple[str, int]:
    pairs = _parse_advisor_pairs()
    if not pairs:
        raise RuntimeError("no unindexed_foreign_keys in advisor dump")
    tables = [p[0] for p in pairs]
    fks = [p[1] for p in pairs]
    conn = psycopg2.connect(_dsn(), connect_timeout=15)
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(QUERY, {"tables": tables, "fks": fks})
        rows = cur.fetchall()
    finally:
        conn.close()

    lines: list[str] = []
    lines.append("-- FK covering indexes")
    lines.append("-- Supabase performance advisor: 42 FK kolonunda covering")
    lines.append("-- index yok → JOIN/cascade DELETE yavaş. Bu migration her")
    lines.append("-- FK için `CREATE INDEX IF NOT EXISTS` ekler.")
    lines.append("-- Üretilen: scripts/build_fk_index_migration.py")
    lines.append("")
    lines.append("BEGIN;")
    lines.append("")

    for r in rows:
        schema = r["schema_name"]
        tbl = r["table_name"]
        fk_name = r["fk_name"]
        cols = r["fk_columns"]
        # Index adı: ifk_<table>_<col>[_<col2>]. Schema farklı olabilir
        # ama tablo adı + kolon kombinasyonu çoğu zaman benzersiz olur.
        # Çakışma riski için fk_name suffix'ini eklemek yerine cols listesi
        # tutuyoruz.
        cols_safe = "_".join(c.lower() for c in cols)
        idx_name = f"ifk_{tbl}_{cols_safe}"
        # 63 char Postgres identifier limit
        if len(idx_name) > 63:
            idx_name = idx_name[:60] + "_x"
        target = f"{_quote_ident(schema)}.{_quote_ident(tbl)}"
        col_list = ", ".join(_quote_ident(c) for c in cols)
        lines.append(f"-- {schema}.{tbl} ({fk_name}) → ({', '.join(cols)})")
        lines.append(
            f"CREATE INDEX IF NOT EXISTS {_quote_ident(idx_name)} ON {target} ({col_list});"
        )
        lines.append("")

    lines.append("COMMIT;")
    lines.append("")
    return "\n".join(lines), len(rows)


def main() -> int:
    sql, count = build_sql()
    if count == 0:
        print("no FK without covering index — nothing to do")
        return 0
    ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    name = "fk_covering_indexes"
    out = MIGRATIONS_DIR / f"{ts}_{name}.sql"
    out.write_text(sql, encoding="utf-8")
    print(f"wrote {out} ({count} indexes, {len(sql)} chars)")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except RuntimeError as e:
        print(f"error: {e}", file=sys.stderr)
        sys.exit(2)
