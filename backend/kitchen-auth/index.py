"""
Проверка пароля для входа в кухонный монитор Sweep Kitchen.
"""

import os
import json
import hashlib


def handler(event: dict, context) -> dict:
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json",
    }

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": headers, "body": ""}

    try:
        body = json.loads(event.get("body") or "{}")
        password = body.get("password", "")
    except Exception:
        return {"statusCode": 400, "headers": headers, "body": json.dumps({"ok": False, "error": "Bad request"})}

    correct = os.environ.get("KITCHEN_PASSWORD", "")
    if password == correct:
        token = hashlib.sha256(f"sweep-kitchen-{correct}".encode()).hexdigest()
        return {"statusCode": 200, "headers": headers, "body": json.dumps({"ok": True, "token": token})}

    return {"statusCode": 401, "headers": headers, "body": json.dumps({"ok": False, "error": "Неверный пароль"})}
