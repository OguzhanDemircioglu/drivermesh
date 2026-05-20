"""Generate RLS auth_rls_initplan optimization migration.

Supabase advisor flag'ı `auth_rls_initplan` her satırda `auth.uid()` /
`auth.jwt()` / `auth.role()` çağıran policy'leri işaretler. PostgreSQL
initplan optimization sub-SELECT içine wrap edilince devreye girer →
fonksiyon **tek kere** çağrılır.

Bu script `public` + `filoLocal` schema'larındaki tüm bu policy'leri
DROP + CREATE şeklinde yeniden yazar:

  auth.uid()  →  (SELECT auth.uid())
  auth.jwt()  →  (SELECT auth.jwt())
  auth.role() →  (SELECT auth.role())

Tek transaction (BEGIN/COMMIT) — her şey geçer veya hiçbiri geçmez.

Çıktı: supabase/migrations/<ts>_rls_auth_uid_initplan_optimization.sql
"""
from __future__ import annotations

import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import psycopg2  # type: ignore
import psycopg2.extras  # type: ignore

PROJECT_REF = "ucitxvsndlwvvnqwabgo"
ROOT = Path(__file__).resolve().parent.parent
MIGRATIONS_DIR = ROOT / "supabase" / "migrations"

# auth.<lowercase_func>() — parantezsiz, henüz `(SELECT ...)` içinde olmayan.
# Negative lookbehind: önünde `(` yoksa = wrap edilmemiş.
AUTH_CALL_RE = re.compile(r"(?<![(])(auth\.[a-z_]+)\(\)")


def _dsn() -> str:
    pw = os.environ.get("DB_PASS") or os.environ.get("SUPABASE_DB_PASSWORD")
    if not pw:
        raise RuntimeError("DB_PASS or SUPABASE_DB_PASSWORD not set")
    return (
        f"postgresql://postgres.{PROJECT_REF}:{pw}"
        f"@aws-1-eu-central-1.pooler.supabase.com:5432/postgres"
    )


def _fix(expr: str | None) -> str | None:
    if expr is None:
        return None
    return AUTH_CALL_RE.sub(r"(SELECT \1())", expr)


def _quote_ident(s: str) -> str:
    # filoLocal has uppercase letters → must be quoted. policy names can have
    # spaces → must be quoted too.
    return '"' + s.replace('"', '""') + '"'


def _format_roles(roles: list[str]) -> str:
    # Postgres reserved role names aren't keywords for CREATE POLICY ... TO,
    # ama 'public' her zaman kabul edilir. Çift tırnak güvenli.
    return ", ".join(_quote_ident(r) if not r.isidentifier() else r for r in roles)


def build_sql() -> tuple[str, int]:
    conn = psycopg2.connect(_dsn(), connect_timeout=15)
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """
            SELECT schemaname, tablename, policyname, cmd, permissive, roles,
                   qual, with_check
            FROM pg_policies
            WHERE schemaname IN ('public','filoLocal')
              AND (
                qual ~ '(?<![(])auth\\.[a-z_]+\\(\\)' OR
                with_check ~ '(?<![(])auth\\.[a-z_]+\\(\\)'
              )
            ORDER BY schemaname, tablename, policyname;
            """
        )
        rows = cur.fetchall()
    finally:
        conn.close()

    lines: list[str] = []
    lines.append("-- RLS auth_rls_initplan optimization")
    lines.append("-- Supabase performance advisor: 72 policy 'auth.X()' her satır için")
    lines.append("-- yeniden değerlendiriyordu. `(SELECT auth.X())` ile wrap edildiğinde")
    lines.append("-- PostgreSQL initplan optimization devreye girer → tek call.")
    lines.append("-- Üretilen: scripts/build_rls_initplan_migration.py")
    lines.append("")
    lines.append("BEGIN;")
    lines.append("")

    for r in rows:
        schema = r["schemaname"]
        tbl = r["tablename"]
        polname = r["policyname"]
        cmd = r["cmd"]
        permissive = r["permissive"]  # 'PERMISSIVE' or 'RESTRICTIVE'
        roles = r["roles"]  # list[str]
        qual = _fix(r["qual"])
        with_check = _fix(r["with_check"])

        qschema = _quote_ident(schema)
        qtbl = _quote_ident(tbl)
        qpol = _quote_ident(polname)
        qtarget = f"{qschema}.{qtbl}"

        lines.append(f"-- {schema}.{tbl} / {polname}")
        lines.append(f"DROP POLICY IF EXISTS {qpol} ON {qtarget};")

        parts = [
            f"CREATE POLICY {qpol} ON {qtarget}",
            f"  AS {permissive}",
            f"  FOR {cmd}",
            f"  TO {_format_roles(roles)}",
        ]
        if qual is not None:
            parts.append(f"  USING ({qual})")
        if with_check is not None:
            parts.append(f"  WITH CHECK ({with_check})")
        lines.append("\n".join(parts) + ";")
        lines.append("")

    lines.append("COMMIT;")
    lines.append("")

    return "\n".join(lines), len(rows)


def main() -> int:
    sql, count = build_sql()
    if count == 0:
        print("no policies match — nothing to optimize")
        return 0
    ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    name = "rls_auth_uid_initplan_optimization"
    out = MIGRATIONS_DIR / f"{ts}_{name}.sql"
    out.write_text(sql, encoding="utf-8")
    print(f"wrote {out} ({count} policies, {len(sql)} chars)")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except RuntimeError as e:
        print(f"error: {e}", file=sys.stderr)
        sys.exit(2)
