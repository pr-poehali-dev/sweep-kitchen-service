"""
Telegram-бот Sweep Kitchen.
— Webhook: обрабатывает кнопки и команды /start, /report
— GET ?action=report&day=today|tomorrow — отправка отчёта (используется cron и кнопками)
"""

import os
import json
import urllib.request
import io
from datetime import datetime, date, timedelta

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches


RESTOPLACE_API = "https://api.restoplace.cc"
TELEGRAM_API = "https://api.telegram.org"
MAX_CAPACITY = 114
HOURS = list(range(10, 24))
STATUS_ACTIVE = {1, 2, 3, 4}


# ── Helpers ──────────────────────────────────────────────────────────────────

def fetch_reserves(query_date: str) -> list:
    api_key = os.environ["RESTOPLACE_API_KEY"]
    url = f"{RESTOPLACE_API}/reserves?query[date]={query_date}"
    req = urllib.request.Request(url, headers={"X-API-Key": api_key})
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read())
    if "error" in data:
        raise ValueError(f"RESTOPLACE: {data['error']}")
    return data.get("responseData", [])


def build_hourly_load(reserves: list) -> dict:
    hourly_guests: dict[int, int] = {}
    for r in reserves:
        if r.get("status") not in STATUS_ACTIVE:
            continue
        try:
            dt_from = datetime.strptime(r["time_from"], "%Y-%m-%d %H:%M:%S")
            dt_to = datetime.strptime(r["time_to"], "%Y-%m-%d %H:%M:%S")
        except Exception:
            continue
        count = r.get("count", 0)
        if count <= 0:
            continue
        from_min = dt_from.hour * 60 + dt_from.minute
        to_min = dt_to.hour * 60 + dt_to.minute
        for h in HOURS:
            if from_min < (h + 1) * 60 and to_min > h * 60:
                hourly_guests[h] = hourly_guests.get(h, 0) + count
    return {h: (hourly_guests.get(h, 0), min(round(hourly_guests.get(h, 0) / MAX_CAPACITY * 100), 100)) for h in HOURS}


def get_color(pct: int) -> str:
    if pct == 0: return "#2a2d35"
    if pct <= 40: return "#3aad5a"
    if pct <= 70: return "#f5a623"
    if pct <= 89: return "#e8612a"
    return "#e03030"


def load_emoji(pct: int) -> str:
    if pct == 0: return "⚪️"
    if pct <= 40: return "🟢"
    if pct <= 70: return "🟡"
    if pct <= 89: return "🟠"
    return "🔴"


def build_chart(hourly: dict, date_label: str) -> bytes:
    fig, ax = plt.subplots(figsize=(12, 5))
    fig.patch.set_facecolor("#0f1117")
    ax.set_facecolor("#0f1117")

    pcts = [hourly[h][1] for h in HOURS]
    guests = [hourly[h][0] for h in HOURS]
    colors = [get_color(p) for p in pcts]

    bars = ax.bar(range(len(HOURS)), pcts, color=colors, width=0.7, zorder=3)

    for y in [25, 50, 75, 100]:
        ax.axhline(y, color="#1e2130", linewidth=0.8, linestyle="--", zorder=1)

    for i, (bar, pct, g) in enumerate(zip(bars, pcts, guests)):
        if pct > 0:
            ax.text(bar.get_x() + bar.get_width() / 2, pct + 1.5,
                    f"{pct}%", ha="center", va="bottom",
                    color=colors[i], fontsize=8, fontweight="bold")
            ax.text(bar.get_x() + bar.get_width() / 2, pct / 2,
                    f"{g}ч", ha="center", va="center",
                    color="white", fontsize=7, alpha=0.85)

    ax.set_xticks(range(len(HOURS)))
    ax.set_xticklabels([f"{h}:00" for h in HOURS], color="#8892a4", fontsize=9)
    ax.set_ylim(0, 115)
    ax.set_yticks([0, 25, 50, 75, 100])
    ax.set_yticklabels(["0%", "25%", "50%", "75%", "100%"], color="#8892a4", fontsize=9)
    ax.tick_params(axis="both", which="both", length=0)
    for spine in ax.spines.values():
        spine.set_visible(False)

    legend_items = [
        mpatches.Patch(color="#3aad5a", label="До 40% — спокойно"),
        mpatches.Patch(color="#f5a623", label="До 70% — умеренно"),
        mpatches.Patch(color="#e8612a", label="До 89% — загружено"),
        mpatches.Patch(color="#e03030", label="90%+ — пик"),
    ]
    ax.legend(handles=legend_items, loc="upper left", framealpha=0.15,
              facecolor="#1a1d28", edgecolor="#2a2d3a", labelcolor="white", fontsize=8)
    ax.set_title(f"Загрузка зала · {date_label} · макс. {MAX_CAPACITY} мест",
                 color="#e8e8e8", fontsize=11, pad=12, fontweight="bold")

    plt.tight_layout()
    buf = io.BytesIO()
    plt.savefig(buf, format="png", dpi=150, bbox_inches="tight",
                facecolor="#0f1117", edgecolor="none")
    plt.close(fig)
    buf.seek(0)
    return buf.read()


def build_text(reserves: list, hourly: dict, date_label: str, is_tomorrow: bool) -> str:
    active = [r for r in reserves if r.get("status") in STATUS_ACTIVE]
    total_guests = sum(r.get("count", 0) for r in active)
    peak_pct = max((v[1] for v in hourly.values()), default=0)
    peak_hour = next((h for h, v in hourly.items() if v[1] == peak_pct and v[1] > 0), None)
    label = "Завтра" if is_tomorrow else "Сегодня"

    lines = [
        f"🍽 *Sweep Kitchen — {label}, {date_label}*",
        "",
        f"📋 Броней: *{len(active)}*",
        f"👥 Гостей всего: *{total_guests}*",
        f"📍 Вместимость: {MAX_CAPACITY} мест",
    ]
    if peak_hour:
        lines.append(f"⚡️ Пик: *{peak_pct}%* в {peak_hour}:00 {load_emoji(peak_pct)}")

    lines += ["", "📊 *Загрузка по часам:*"]
    for h in HOURS:
        g, pct = hourly[h]
        if pct == 0:
            continue
        bar_len = round(pct / 10)
        bar = "█" * bar_len + "░" * (10 - bar_len)
        lines.append(f"`{h}:00` {load_emoji(pct)} `{bar}` *{pct}%* ({g} чел)")

    msk_time = datetime.utcnow() + timedelta(hours=3)
    lines += ["", f"_Обновлено: {msk_time.strftime('%H:%M')} МСК_"]
    return "\n".join(lines)


def send_report(day: str):
    token = os.environ["TELEGRAM_BOT_TOKEN"]
    chat_id = os.environ["TELEGRAM_CHAT_ID"]
    is_tomorrow = day == "tomorrow"
    d = date.today() + timedelta(days=1) if is_tomorrow else date.today()
    date_str = d.strftime("%Y-%m-%d")

    reserves = fetch_reserves(date_str)
    hourly = build_hourly_load(reserves)
    date_label = d.strftime("%-d %B")
    text = build_text(reserves, hourly, date_label, is_tomorrow)
    chart_bytes = build_chart(hourly, date_label)

    today_label = date.today().strftime("%-d %B")
    tomorrow_label = (date.today() + timedelta(days=1)).strftime("%-d %B")
    keyboard = json.dumps({"inline_keyboard": [[
        {"text": f"📅 Сегодня ({today_label})", "callback_data": "report_today"},
        {"text": f"📆 Завтра ({tomorrow_label})", "callback_data": "report_tomorrow"},
    ]]})

    boundary = "KitchenBoundary7x"
    def field(name, value):
        return (f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{value}").encode()

    body = b"\r\n".join([
        field("chat_id", chat_id),
        field("caption", text),
        field("parse_mode", "Markdown"),
        field("reply_markup", keyboard),
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"photo\"; filename=\"chart.png\"\r\nContent-Type: image/png\r\n\r\n".encode() + chart_bytes,
        f"--{boundary}--".encode(),
    ])

    req = urllib.request.Request(
        f"{TELEGRAM_API}/bot{token}/sendPhoto",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def tg_post(token: str, method: str, payload: dict):
    url = f"{TELEGRAM_API}/bot{token}/{method}"
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read())


# ── Handler ───────────────────────────────────────────────────────────────────

def handler(event: dict, context) -> dict:
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json",
    }

    # Cron-вызов от планировщика (каждые 10 минут проверяем время МСК 10:00)
    if event.get("source") == "cron" or event.get("httpMethod") is None:
        now_utc = datetime.utcnow()
        now_msk_h = (now_utc.hour + 3) % 24
        now_msk_m = now_utc.minute
        if now_msk_h == 10 and now_msk_m < 10:
            send_report("today")
        return {"statusCode": 200, "headers": headers, "body": json.dumps({"ok": True, "cron": True})}

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": headers, "body": ""}

    # POST /auth — проверка пароля (объединено из kitchen-auth)
    if event.get("httpMethod") == "POST":
        try:
            raw = json.loads(event.get("body") or "{}")
        except Exception:
            raw = {}
        if "password" in raw:
            import hashlib
            password = raw.get("password", "")
            correct = os.environ.get("KITCHEN_PASSWORD", "")
            if password == correct:
                token_hash = hashlib.sha256(f"sweep-kitchen-{correct}".encode()).hexdigest()
                return {"statusCode": 200, "headers": headers,
                        "body": json.dumps({"ok": True, "token": token_hash})}
            return {"statusCode": 401, "headers": headers,
                    "body": json.dumps({"ok": False, "error": "Неверный пароль"})}

    # GET ?action=setup — регистрация webhook
    if event.get("httpMethod") == "GET":
        params = event.get("queryStringParameters") or {}
        if params.get("action") == "setup":
            token = os.environ["TELEGRAM_BOT_TOKEN"]
            webhook_url = "https://functions.poehali.dev/07ca1f2c-9e8f-448d-9162-14636eddcc62"
            result = tg_post(token, "setWebhook", {"url": webhook_url, "allowed_updates": ["message", "callback_query"]})
            return {"statusCode": 200, "headers": headers,
                    "body": json.dumps({"ok": True, "webhook": result}, ensure_ascii=False)}

    # GET ?day=today|tomorrow — прямой вызов (cron / ручной)
    if event.get("httpMethod") == "GET":
        params = event.get("queryStringParameters") or {}
        day = params.get("day", "today")
        result = send_report(day)
        return {"statusCode": 200, "headers": headers,
                "body": json.dumps({"ok": True, "tg": result}, ensure_ascii=False)}

    # POST — webhook от Telegram
    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        return {"statusCode": 200, "headers": headers, "body": json.dumps({"ok": True})}

    token = os.environ["TELEGRAM_BOT_TOKEN"]

    # Кнопки
    if "callback_query" in body:
        cq = body["callback_query"]
        day = "tomorrow" if cq.get("data") == "report_tomorrow" else "today"
        tg_post(token, "answerCallbackQuery", {
            "callback_query_id": cq["id"],
            "text": "Готовлю отчёт... ⏳",
        })
        try:
            send_report(day)
        except Exception as e:
            chat_id = cq["message"]["chat"]["id"]
            tg_post(token, "sendMessage", {
                "chat_id": chat_id,
                "text": f"⚠️ Ошибка: {str(e)[:200]}",
            })
        return {"statusCode": 200, "headers": headers, "body": json.dumps({"ok": True})}

    # Команды /start, /report
    if "message" in body:
        msg = body["message"]
        text = msg.get("text", "")
        chat_id = msg["chat"]["id"]
        if text.startswith("/start") or text.startswith("/report"):
            today_label = date.today().strftime("%-d %B")
            tomorrow_label = (date.today() + timedelta(days=1)).strftime("%-d %B")
            tg_post(token, "sendMessage", {
                "chat_id": chat_id,
                "text": "👨‍🍳 *Sweep Kitchen* — кухонный монитор\n\nВыберите отчёт:",
                "parse_mode": "Markdown",
                "reply_markup": json.dumps({"inline_keyboard": [[
                    {"text": f"📅 Сегодня ({today_label})", "callback_data": "report_today"},
                    {"text": f"📆 Завтра ({tomorrow_label})", "callback_data": "report_tomorrow"},
                ]]}),
            })

    return {"statusCode": 200, "headers": headers, "body": json.dumps({"ok": True})}