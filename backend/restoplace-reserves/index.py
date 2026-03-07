"""
Получение бронирований из RESTOPLACE API для кухонного монитора Sweep Kitchen.
Возвращает бронирования за указанный рабочий день и статистику загрузки по часам.
"""

import os
import json
import urllib.request
import urllib.parse
from datetime import datetime, date


RESTOPLACE_API = "https://api.restoplace.cc"

STATUS_MAP = {
    1: "new",
    2: "pending",
    3: "waiting",
    4: "open",
    5: "closed",
    6: "cancelled",
    8: "cancelled_no_deposit",
}

STATUS_LABEL = {
    1: "Новая",
    2: "Заявка",
    3: "Ожидаем",
    4: "Открыт",
    5: "Закрыт",
    6: "Отменён",
    8: "Отменён",
}


def fetch_reserves(query_date: str) -> list:
    api_key = os.environ["RESTOPLACE_API_KEY"]
    url = f"{RESTOPLACE_API}/reserves?query[date]={query_date}"
    req = urllib.request.Request(url, headers={"X-API-Key": api_key})
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read())
    if "error" in data:
        raise ValueError(f"RESTOPLACE error: {data['error']}")
    return data.get("responseData", [])


def build_hourly_load(reserves: list) -> dict:
    """
    Считаем сколько гостей физически сидит в зале в каждый час.
    Гость присутствует в часе H если: time_from < H+1:00 AND time_to > H:00
    То есть бронь пересекается с интервалом [H:00, H+1:00).
    """
    hourly_guests: dict[int, int] = {}
    active_statuses = {1, 2, 3, 4}

    for r in reserves:
        if r.get("status") not in active_statuses:
            continue
        try:
            dt_from = datetime.strptime(r["time_from"], "%Y-%m-%d %H:%M:%S")
            dt_to = datetime.strptime(r["time_to"], "%Y-%m-%d %H:%M:%S")
        except Exception:
            continue

        count = r.get("count", 0)
        if count <= 0:
            continue

        # from_minutes и to_minutes — в минутах от полуночи
        from_min = dt_from.hour * 60 + dt_from.minute
        to_min = dt_to.hour * 60 + dt_to.minute

        # Если бронь заканчивается ровно в начале часа (напр. 23:00) — не считаем этот час
        for h in range(10, 24):
            slot_start = h * 60       # начало часа в минутах
            slot_end = (h + 1) * 60   # конец часа в минутах
            # Гость присутствует если бронь пересекает этот часовой слот
            if from_min < slot_end and to_min > slot_start:
                hourly_guests[h] = hourly_guests.get(h, 0) + count

    if not hourly_guests:
        return {}

    MAX_CAPACITY = 114
    return {str(h): min(round((g / MAX_CAPACITY) * 100), 100) for h, g in sorted(hourly_guests.items())}


def format_reserve(r: dict) -> dict:
    status_code = r.get("status", 1)
    is_active = status_code in (3, 4)

    try:
        dt_from = datetime.strptime(r["time_from"], "%Y-%m-%d %H:%M:%S")
        time_str = dt_from.strftime("%H:%M")
    except Exception:
        time_str = "--:--"

    tags = r.get("tags", [])
    comment = r.get("text", "").replace("*", " ").strip()

    return {
        "id": r["id"],
        "reserve_id": r.get("reserve_id"),
        "time": time_str,
        "name": r.get("name", "—"),
        "guests": r.get("count", 0),
        "table": r.get("floor_name", "—"),
        "item_type": r.get("item_type", ""),
        "is_banquet": bool(r.get("is_banquet")),
        "status_code": status_code,
        "status": STATUS_MAP.get(status_code, "unknown"),
        "status_label": STATUS_LABEL.get(status_code, "Неизвестно"),
        "is_active": is_active,
        "comment": comment,
        "tags": tags,
        "phone": r.get("phone", ""),
        "success": bool(r.get("success")),
        "deposit_paid": r.get("depositPaid", 0),
    }


def handler(event: dict, context) -> dict:
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json",
    }

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": headers, "body": ""}

    params = event.get("queryStringParameters") or {}
    query_date = params.get("date", date.today().strftime("%Y-%m-%d"))

    raw_reserves = fetch_reserves(query_date)

    active_statuses = {1, 2, 3, 4}
    reserves = [format_reserve(r) for r in raw_reserves if r.get("status") in active_statuses]
    reserves.sort(key=lambda r: r["time"])

    hourly_load = build_hourly_load(raw_reserves)

    total_guests = sum(r["guests"] for r in reserves if r["is_active"])
    unique_floors = list({r["table"] for r in reserves if r["table"]})

    return {
        "statusCode": 200,
        "headers": headers,
        "body": json.dumps({
            "date": query_date,
            "reserves": reserves,
            "hourly_load": hourly_load,
            "stats": {
                "total_bookings": len(reserves),
                "total_guests_now": total_guests,
                "floors": unique_floors,
            }
        }, ensure_ascii=False),
    }