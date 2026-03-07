"""
Webhook для Telegram-бота Sweep Kitchen.
Обрабатывает callback-кнопки: отправить отчёт сегодня / завтра.
"""

import os
import json
import urllib.request
from datetime import date, timedelta, datetime


TELEGRAM_API = "https://api.telegram.org"


def tg_post(token: str, method: str, payload: dict):
    url = f"{TELEGRAM_API}/bot{token}/{method}"
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        url, data=data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read())


def call_report(day: str):
    report_url = os.environ.get("REPORT_FUNCTION_URL", "")
    req = urllib.request.Request(
        f"{report_url}?day={day}",
        method="GET"
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read())


def handler(event: dict, context) -> dict:
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json",
    }

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": headers, "body": ""}

    token = os.environ["TELEGRAM_BOT_TOKEN"]

    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        return {"statusCode": 200, "headers": headers, "body": json.dumps({"ok": True})}

    # Обработка callback_query (нажатие кнопок)
    if "callback_query" in body:
        cq = body["callback_query"]
        cq_id = cq["id"]
        data = cq.get("data", "")
        chat_id = cq["message"]["chat"]["id"]

        tg_post(token, "answerCallbackQuery", {
            "callback_query_id": cq_id,
            "text": "Готовлю отчёт... ⏳",
        })

        day = "tomorrow" if data == "report_tomorrow" else "today"
        try:
            call_report(day)
        except Exception as e:
            tg_post(token, "sendMessage", {
                "chat_id": chat_id,
                "text": f"⚠️ Ошибка при генерации отчёта: {str(e)[:200]}",
            })

        return {"statusCode": 200, "headers": headers, "body": json.dumps({"ok": True})}

    # Обработка команды /start
    if "message" in body:
        msg = body["message"]
        chat_id = msg["chat"]["id"]
        text = msg.get("text", "")

        if text.startswith("/start") or text.startswith("/report"):
            today = date.today().strftime("%-d %B").lower()
            tomorrow = (date.today() + timedelta(days=1)).strftime("%-d %B").lower()
            tg_post(token, "sendMessage", {
                "chat_id": chat_id,
                "text": f"👨‍🍳 *Sweep Kitchen* — кухонный монитор\n\nВыберите отчёт:",
                "parse_mode": "Markdown",
                "reply_markup": json.dumps({"inline_keyboard": [[
                    {"text": f"📅 Сегодня ({today})", "callback_data": "report_today"},
                    {"text": f"📆 Завтра ({tomorrow})", "callback_data": "report_tomorrow"},
                ]]}),
            })

    return {"statusCode": 200, "headers": headers, "body": json.dumps({"ok": True})}
