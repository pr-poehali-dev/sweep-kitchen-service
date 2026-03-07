"""
Генерация и отправка ежедневного отчёта о загрузке зала в Telegram.
Вызывается по расписанию в 10:00 или вручную через кнопки бота.
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
import numpy as np


RESTOPLACE_API = "https://api.restoplace.cc"
TELEGRAM_API = "https://api.telegram.org"
MAX_CAPACITY = 114
HOURS = list(range(10, 24))

STATUS_ACTIVE = {1, 2, 3, 4}


def get_color(pct: float) -> str:
    if pct == 0:
        return "#2a2d35"
    if pct <= 40:
        return "#3aad5a"
    if pct <= 70:
        return "#f5a623"
    if pct <= 89:
        return "#e8612a"
    return "#e03030"


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
    result = {}
    for h in HOURS:
        g = hourly_guests.get(h, 0)
        result[h] = (g, min(round(g / MAX_CAPACITY * 100), 100))
    return result


def build_chart(hourly: dict, date_label: str) -> bytes:
    fig, ax = plt.subplots(figsize=(12, 5))
    fig.patch.set_facecolor("#0f1117")
    ax.set_facecolor("#0f1117")

    hours = list(hourly.keys())
    pcts = [hourly[h][1] for h in hours]
    guests = [hourly[h][0] for h in hours]
    colors = [get_color(p) for p in pcts]

    bars = ax.bar(range(len(hours)), pcts, color=colors, width=0.7, zorder=3)

    # Линии сетки
    for y in [25, 50, 75, 100]:
        ax.axhline(y, color="#1e2130", linewidth=0.8, linestyle="--", zorder=1)

    # Подписи на столбцах
    for i, (bar, pct, g) in enumerate(zip(bars, pcts, guests)):
        if pct > 0:
            ax.text(
                bar.get_x() + bar.get_width() / 2,
                pct + 1.5,
                f"{pct}%",
                ha="center", va="bottom",
                color=colors[i], fontsize=8, fontweight="bold"
            )
            ax.text(
                bar.get_x() + bar.get_width() / 2,
                pct / 2,
                f"{g}ч",
                ha="center", va="center",
                color="white", fontsize=7, alpha=0.85
            )

    ax.set_xticks(range(len(hours)))
    ax.set_xticklabels([f"{h}:00" for h in hours], color="#8892a4", fontsize=9)
    ax.set_ylim(0, 115)
    ax.set_yticks([0, 25, 50, 75, 100])
    ax.set_yticklabels(["0%", "25%", "50%", "75%", "100%"], color="#8892a4", fontsize=9)
    ax.tick_params(axis="both", which="both", length=0)

    for spine in ax.spines.values():
        spine.set_visible(False)

    # Легенда
    legend_items = [
        mpatches.Patch(color="#3aad5a", label="До 40% — спокойно"),
        mpatches.Patch(color="#f5a623", label="До 70% — умеренно"),
        mpatches.Patch(color="#e8612a", label="До 89% — загружено"),
        mpatches.Patch(color="#e03030", label="90%+ — пик"),
    ]
    ax.legend(handles=legend_items, loc="upper left", framealpha=0.15,
              facecolor="#1a1d28", edgecolor="#2a2d3a",
              labelcolor="white", fontsize=8)

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
    total = len([r for r in reserves if r.get("status") in STATUS_ACTIVE])
    total_guests = sum(r.get("count", 0) for r in reserves if r.get("status") in STATUS_ACTIVE)

    peak_pct = max((v[1] for v in hourly.values()), default=0)
    peak_hour = next((h for h, v in hourly.items() if v[1] == peak_pct), None)

    label = "Завтра" if is_tomorrow else "Сегодня"
    lines = [
        f"🍽 *Sweep Kitchen — {label} {date_label}*",
        "",
        f"📋 Броней: *{total}*",
        f"👥 Гостей всего: *{total_guests}*",
        f"📍 Вместимость: {MAX_CAPACITY} мест",
    ]

    if peak_hour:
        def load_emoji(p):
            if p <= 40: return "🟢"
            if p <= 70: return "🟡"
            if p <= 89: return "🟠"
            return "🔴"
        lines.append(f"⚡️ Пик: *{peak_pct}%* в {peak_hour}:00 {load_emoji(peak_pct)}")

    lines += ["", "📊 *Загрузка по часам:*"]

    for h in HOURS:
        guests_h, pct = hourly.get(h, (0, 0))
        if pct == 0:
            continue
        bar_len = round(pct / 10)
        bar = "█" * bar_len + "░" * (10 - bar_len)
        emoji = load_emoji(pct)
        lines.append(f"`{h}:00` {emoji} `{bar}` *{pct}%* ({guests_h} чел)")

    lines += ["", f"_Данные: RESTOPLACE · {datetime.now().strftime('%H:%M')}_"]
    return "\n".join(lines)


def send_report(date_str: str, is_tomorrow: bool, chat_id: str):
    token = os.environ["TELEGRAM_BOT_TOKEN"]
    reserves = fetch_reserves(date_str)
    hourly = build_hourly_load(reserves)

    d = datetime.strptime(date_str, "%Y-%m-%d")
    date_label = d.strftime("%-d %B").lower()

    text = build_text(reserves, hourly, date_label, is_tomorrow)
    chart_bytes = build_chart(hourly, date_label)

    # Отправка фото с подписью
    boundary = "----KitchenBoundary"
    body_parts = [
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"chat_id\"\r\n\r\n{chat_id}",
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"caption\"\r\n\r\n{text}",
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"parse_mode\"\r\n\r\nMarkdown",
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"reply_markup\"\r\n\r\n" +
        json.dumps({"inline_keyboard": [[
            {"text": "📅 Сегодня", "callback_data": "report_today"},
            {"text": "📆 Завтра", "callback_data": "report_tomorrow"},
        ]]}),
    ]
    body_bytes = b"\r\n".join(p.encode() for p in body_parts)
    body_bytes += b"\r\n--" + boundary.encode()
    body_bytes += b"\r\nContent-Disposition: form-data; name=\"photo\"; filename=\"chart.png\"\r\n"
    body_bytes += b"Content-Type: image/png\r\n\r\n"
    body_bytes += chart_bytes
    body_bytes += b"\r\n--" + boundary.encode() + b"--\r\n"

    url = f"{TELEGRAM_API}/bot{token}/sendPhoto"
    req = urllib.request.Request(
        url, data=body_bytes,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def handler(event: dict, context) -> dict:
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json",
    }

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": headers, "body": ""}

    params = event.get("queryStringParameters") or {}
    day = params.get("day", "today")
    is_tomorrow = day == "tomorrow"

    chat_id = os.environ["TELEGRAM_CHAT_ID"]
    if is_tomorrow:
        d = date.today() + timedelta(days=1)
    else:
        d = date.today()

    result = send_report(d.strftime("%Y-%m-%d"), is_tomorrow, chat_id)

    return {
        "statusCode": 200,
        "headers": headers,
        "body": json.dumps({"ok": True, "tg": result}, ensure_ascii=False),
    }
