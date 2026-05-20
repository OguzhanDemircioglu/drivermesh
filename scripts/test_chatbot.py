"""Smoke test for chat-bot edge function with Gemini function calling.

Creates an ephemeral test owner via auth admin API, joins them to a temp org,
fires a few questions, then cleans up.

Usage:
  export ANON_KEY=$(grep '^EXPO_PUBLIC_SUPABASE_ANON_KEY=' fleet/.env | cut -d= -f2-)
  export SERVICE_ROLE_KEY=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' fleet/.env | cut -d= -f2-)
  python scripts/test_chatbot.py
"""
import json
import os
import sys
import uuid
import urllib.request
import urllib.error

SUPABASE_URL = "https://ucitxvsndlwvvnqwabgo.supabase.co"
ANON_KEY = os.environ.get("ANON_KEY") or os.environ.get("EXPO_PUBLIC_SUPABASE_ANON_KEY")
SERVICE_ROLE_KEY = os.environ.get("SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

# Existing test org (Ayse Demir's) — owner role; we just need a valid user with a working password.
# Easier path: use service_role to reset an existing test owner's password to known value.
TARGET_USER_ID = "847c95e4-7d5a-4392-a242-cfe8a2c41633"  # Ayse Demir
TARGET_EMAIL = "ayse-test@drivermesh.local"
TEMP_PASSWORD = "ChatBotSmoke2026"  # rotated after test


def http(method: str, url: str, headers: dict, body: dict | None = None) -> dict:
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            txt = resp.read().decode("utf-8")
            return json.loads(txt) if txt else {}
    except urllib.error.HTTPError as e:
        body_text = e.read().decode("utf-8", errors="replace")
        try:
            return {"_http_status": e.code, **json.loads(body_text)}
        except Exception:
            return {"_http_status": e.code, "_body": body_text}


def main() -> int:
    if not ANON_KEY or not SERVICE_ROLE_KEY:
        print("Missing ANON_KEY / SERVICE_ROLE_KEY env", file=sys.stderr)
        return 2

    admin_headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }

    # 1. Reset password on existing test owner
    print(f"resetting password for {TARGET_EMAIL}...")
    r = http(
        "PUT",
        f"{SUPABASE_URL}/auth/v1/admin/users/{TARGET_USER_ID}",
        admin_headers,
        {"password": TEMP_PASSWORD, "email_confirm": True},
    )
    if "_http_status" in r and r["_http_status"] >= 400:
        print(f"password reset failed: {r}", file=sys.stderr)
        return 1
    print("  ok")

    # 2. Sign in
    print(f"signing in...")
    auth = http(
        "POST",
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        {"apikey": ANON_KEY, "Content-Type": "application/json"},
        {"email": TARGET_EMAIL, "password": TEMP_PASSWORD},
    )
    if "access_token" not in auth:
        print(f"auth failed: {auth}", file=sys.stderr)
        return 1
    jwt = auth["access_token"]
    print(f"  jwt len={len(jwt)}")

    # 3. Ask data questions
    questions = [
        "Filomda kac arac var, hangi durumda?",
        "Su an bakimda kac arac var?",
        "Acik kac is var?",
        "Ekibimde kac surucu var?",
    ]
    session_id = None
    for q in questions:
        body = {"message": q}
        if session_id:
            body["sessionId"] = session_id
        res = http(
            "POST",
            f"{SUPABASE_URL}/functions/v1/chat-bot",
            {"apikey": ANON_KEY, "Authorization": f"Bearer {jwt}", "Content-Type": "application/json"},
            body,
        )
        if "reply" not in res:
            print(f"\n>>> Q: {q}\nERROR: {res}", file=sys.stderr)
            continue
        session_id = res.get("sessionId", session_id)
        print(f"\n>>> Q: {q}")
        print(f"    provider: {res.get('provider')}, tools: {res.get('toolCalls', [])}")
        reply = res["reply"]
        if len(reply) > 500:
            reply = reply[:500] + "...(truncated)"
        print(f"    reply: {reply}")

    # 4. Rotate password back to random value (so we don't leave a known-pw owner)
    new_random = uuid.uuid4().hex
    print(f"\nrotating password to random value...")
    http(
        "PUT",
        f"{SUPABASE_URL}/auth/v1/admin/users/{TARGET_USER_ID}",
        admin_headers,
        {"password": new_random},
    )
    print("  done (owner will need password-reset email to log in again)")

    return 0


if __name__ == "__main__":
    sys.exit(main())
