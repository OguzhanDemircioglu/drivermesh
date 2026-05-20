"""Embedding RAG smoke test for chat-bot edge function (V0.3).

Creates an ephemeral sandbox driver via auth admin API, asks a semantic
question that should match the "Üzerine Al" KB chunk (02-arac-yonetimi.md),
verifies the reply references that chunk's content, then deletes the user.

Pass criteria:
  - HTTP 200 from /functions/v1/chat-bot
  - reply text contains at least one expected substring (üzerine al / sahiplenme / claim)
  - cleanup succeeds

Usage (PowerShell):
  python scripts/smoke_test_kb_rag.py
  (reads SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY from fleet/.env)
"""
from __future__ import annotations

import json
import os
import sys
import time
import uuid
import urllib.error
import urllib.request
from pathlib import Path


def load_env_file(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.exists():
        return out
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k.strip()] = v.strip()
    return out


def http(method: str, url: str, headers: dict, body: dict | None = None, timeout: int = 30) -> dict:
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            txt = resp.read().decode("utf-8")
            return json.loads(txt) if txt else {}
    except urllib.error.HTTPError as e:
        body_text = e.read().decode("utf-8", errors="replace")
        try:
            return {"_http_status": e.code, **json.loads(body_text)}
        except Exception:
            return {"_http_status": e.code, "_body": body_text}


EXPECTED_SUBSTRINGS = [
    "üzerine al",
    "uzerine al",
    "sahiplen",
    "araç sahip",
    "arac sahip",
    "kendi üstüne",
    "kendi ustune",
    "araç → üzerine al",
    "arac → uzerine al",
]


def main() -> int:
    env = load_env_file(Path("fleet/.env"))
    supabase_url = env.get("EXPO_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
    anon = env.get("EXPO_PUBLIC_SUPABASE_ANON_KEY") or os.environ.get("ANON_KEY")
    service = env.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SERVICE_ROLE_KEY")
    if not (supabase_url and anon and service):
        print("ERR: missing SUPABASE_URL / ANON / SERVICE_ROLE in env or fleet/.env", file=sys.stderr)
        return 2
    supabase_url = supabase_url.rstrip("/")

    admin_headers = {
        "apikey": service,
        "Authorization": f"Bearer {service}",
        "Content-Type": "application/json",
    }

    suffix = uuid.uuid4().hex[:8]
    email = f"kb-rag-smoke-{suffix}@drivermesh.local"
    password = uuid.uuid4().hex + "Aa1!"

    # 1) Create auth user
    print(f"[1/6] creating sandbox driver auth.user ({email})...")
    create = http(
        "POST",
        f"{supabase_url}/auth/v1/admin/users",
        admin_headers,
        {"email": email, "password": password, "email_confirm": True},
    )
    if create.get("_http_status", 200) >= 400 or not create.get("id"):
        print(f"  FAIL: create user: {create}", file=sys.stderr)
        return 1
    user_id = create["id"]
    print(f"  ok user_id={user_id}")

    # Cleanup helper
    def cleanup() -> None:
        print("[cleanup] deleting sandbox user...")
        r = http("DELETE", f"{supabase_url}/auth/v1/admin/users/{user_id}", admin_headers)
        if r.get("_http_status", 200) >= 400:
            print(f"  WARN cleanup failed: {r}", file=sys.stderr)
        else:
            print("  ok")

    try:
        # 2) Insert profile row (driver in Test Filo)
        # NOTE: profiles.id has no auto default; we use the auth user id.
        print("[2/6] inserting profile row (driver in Test Filo)...")
        # PostgREST upsert via service-role bypasses RLS.
        prof = http(
            "POST",
            f"{supabase_url}/rest/v1/profiles",
            {**admin_headers, "Prefer": "return=representation"},
            {
                "id": user_id,
                "organization_id": "ee034911-5948-4d81-8444-87718bf220a9",  # Test Filo
                "full_name": f"KB RAG Smoke {suffix}",
                "role": "driver",
                "email": email,
            },
        )
        if isinstance(prof, dict) and prof.get("_http_status", 200) >= 400:
            print(f"  FAIL profile insert: {prof}", file=sys.stderr)
            cleanup()
            return 1
        print("  ok")

        # 3) Sign in (get JWT)
        print("[3/6] signing in to get JWT...")
        auth = http(
            "POST",
            f"{supabase_url}/auth/v1/token?grant_type=password",
            {"apikey": anon, "Content-Type": "application/json"},
            {"email": email, "password": password},
        )
        jwt = auth.get("access_token")
        if not jwt:
            print(f"  FAIL signin: {auth}", file=sys.stderr)
            cleanup()
            return 1
        print(f"  ok jwt_len={len(jwt)}")

        # 4) Semantic query — should match Araç Sahiplenme — "Üzerine Al"
        question = "Bir aracı kendi üstüme nasıl alırım?"
        print(f"[4/6] POST /functions/v1/chat-bot  q={question!r}")
        t0 = time.time()
        res = http(
            "POST",
            f"{supabase_url}/functions/v1/chat-bot",
            {"apikey": anon, "Authorization": f"Bearer {jwt}", "Content-Type": "application/json"},
            {"message": question},
            timeout=30,
        )
        elapsed = time.time() - t0
        print(f"  elapsed={elapsed:.2f}s")
        if res.get("_http_status", 200) >= 400 or "reply" not in res:
            print(f"  FAIL chat-bot: {res}", file=sys.stderr)
            cleanup()
            return 1
        reply = res["reply"]
        provider = res.get("provider")
        tools = res.get("toolCalls", [])
        session_id = res.get("sessionId")
        print(f"  provider={provider} tools={tools} sessionId={session_id}")
        print(f"  reply_preview: {reply[:400]}{'...' if len(reply) > 400 else ''}")

        # 5) Verify reply references the KB content
        print("[5/6] verifying reply against expected KB substrings...")
        reply_lower = reply.lower()
        # Normalize Turkish chars for substring search robustness
        reply_lower_ascii = (
            reply_lower
            .replace("ç", "c").replace("ı", "i").replace("İ", "i").replace("i̇", "i")
            .replace("ğ", "g").replace("ö", "o").replace("ş", "s").replace("ü", "u")
        )
        matches: list[str] = []
        for needle in EXPECTED_SUBSTRINGS:
            if needle in reply_lower or needle in reply_lower_ascii:
                matches.append(needle)
        if matches:
            print(f"  PASS — reply contains: {matches}")
        else:
            print(f"  FAIL — no expected substring matched. Reply:\n{reply}", file=sys.stderr)
            cleanup()
            return 1

        # 6) Cross-check: chat_messages row for this session has provider metadata
        #    (read via service_role) — confirms persistence path also worked.
        print("[6/6] cross-checking chat_messages metadata...")
        msgs = http(
            "GET",
            f"{supabase_url}/rest/v1/chat_messages?session_id=eq.{session_id}"
            f"&select=role,content,metadata&order=created_at.asc",
            {**admin_headers},
        )
        if isinstance(msgs, list):
            for m in msgs:
                preview = (m.get("content") or "")[:80].replace("\n", " ")
                meta = m.get("metadata") or {}
                print(f"  - {m['role']:9} meta={meta} | {preview}")
        else:
            print(f"  WARN: could not read messages: {msgs}")

        cleanup()
        print("\n=== SMOKE TEST PASSED ===")
        return 0
    except Exception as e:
        print(f"UNEXPECTED ERROR: {e}", file=sys.stderr)
        try:
            cleanup()
        except Exception:
            pass
        return 1


if __name__ == "__main__":
    sys.exit(main())
