"""One-shot: reset Mehmet Yildiz (test driver) password to a known temp value
for native smoke testing. After test, rotate back to a random value.

Usage:
  export SERVICE_ROLE_KEY=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' fleet/.env | cut -d= -f2-)
  python scripts/reset_driver_password.py reset    # sets temp pw
  python scripts/reset_driver_password.py rotate   # sets random pw
"""
import json
import os
import sys
import uuid
import urllib.request
import urllib.error

SUPABASE_URL = "https://ucitxvsndlwvvnqwabgo.supabase.co"
TARGET_USER_ID = "76d61d7f-a93f-4f23-ab34-aa703cb38b79"
TEMP_PASSWORD = "OfflineQueueSmoke2026"


def http(method, url, headers, body=None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            txt = resp.read().decode("utf-8")
            return json.loads(txt) if txt else {}
    except urllib.error.HTTPError as e:
        return {"_status": e.code, "_body": e.read().decode("utf-8", errors="replace")}


def main():
    action = sys.argv[1] if len(sys.argv) > 1 else "reset"
    key = os.environ.get("SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        print("Missing SERVICE_ROLE_KEY env", file=sys.stderr)
        return 2
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    new_pw = TEMP_PASSWORD if action == "reset" else uuid.uuid4().hex
    res = http("PUT", f"{SUPABASE_URL}/auth/v1/admin/users/{TARGET_USER_ID}",
               headers, {"password": new_pw, "email_confirm": True})
    if "_status" in res and res["_status"] >= 400:
        print(f"FAIL: {res}", file=sys.stderr)
        return 1
    if action == "reset":
        print(f"OK: mehmet-test@drivermesh.local password set to known temp value")
    else:
        print(f"OK: mehmet-test@drivermesh.local password rotated to random value")
    return 0


if __name__ == "__main__":
    sys.exit(main())
