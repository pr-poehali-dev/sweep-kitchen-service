import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";

const API_URL = "https://functions.poehali.dev/0bff2ffe-38a1-4586-a21d-17a71ef8329c";

const HOURS = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];

interface Reserve {
  id: number;
  reserve_id: number;
  time: string;
  name: string;
  guests: number;
  table: string;
  item_type: string;
  is_banquet: boolean;
  status_code: number;
  status: string;
  status_label: string;
  is_active: boolean;
  comment: string;
  tags: string[];
  phone: string;
  success: boolean;
  deposit_paid: number;
}

interface Stats {
  total_bookings: number;
  total_guests_now: number;
  floors: string[];
}

interface ApiResponse {
  date: string;
  reserves: Reserve[];
  hourly_load: Record<string, number>;
  stats: Stats;
}

const TAG_LABELS: Record<string, string> = {
  birthday: "ДР",
  alcohol: "Алкоголь",
  corkage: "Своё вино",
  not_transplant: "Не пересаживать",
  vegan: "Веган",
  vegetarian: "Вегетарианец",
  allergy: "Аллергия",
};

function getLoadColor(load: number): string {
  if (load <= 30) return "hsl(120 60% 42%)";
  if (load <= 60) return "hsl(43 96% 56%)";
  if (load <= 85) return "hsl(16 90% 52%)";
  return "hsl(0 72% 50%)";
}

function getLoadLabel(load: number): { label: string; cls: string } {
  if (load <= 30) return { label: "Спокойно", cls: "text-peak-low" };
  if (load <= 60) return { label: "Умеренно", cls: "text-peak-mid" };
  if (load <= 85) return { label: "Загружено", cls: "text-peak-high" };
  return { label: "ПИК", cls: "text-peak-critical" };
}

function getNow() {
  const now = new Date();
  return now.getHours() + now.getMinutes() / 60;
}

function useCurrentTime() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  return time;
}

function getTodayStr() {
  return new Date().toISOString().split("T")[0];
}

interface NotificationItem {
  id: number;
  text: string;
  type: "info" | "warn" | "crit";
}

function Notification({ text, type, onClose }: { text: string; type: "info" | "warn" | "crit"; onClose: () => void }) {
  const colors = {
    info: "border-l-[hsl(120_60%_42%)] bg-[hsl(120_60%_10%/0.5)]",
    warn: "border-l-[hsl(43_96%_56%)] bg-[hsl(43_60%_10%/0.5)]",
    crit: "border-l-[hsl(0_72%_50%)] bg-[hsl(0_50%_10%/0.5)]",
  };
  const iconColors = { info: "text-peak-low", warn: "text-peak-mid", crit: "text-peak-critical" };
  const iconNames: Record<string, string> = { info: "Info", warn: "AlertTriangle", crit: "AlertOctagon" };

  return (
    <div className={`flex items-center gap-3 px-4 py-2 border-l-2 rounded-sm animate-fade-in ${colors[type]}`}>
      <Icon name={iconNames[type]} size={13} className={iconColors[type]} fallback="Info" />
      <span className="text-xs text-foreground flex-1">{text}</span>
      <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
        <Icon name="X" size={11} />
      </button>
    </div>
  );
}

function LoadChart({ hourlyLoad }: { hourlyLoad: Record<string, number> }) {
  const now = getNow();
  const values = HOURS.map((h) => hourlyLoad[String(h)] ?? 0);
  const maxLoad = Math.max(...values, 1);
  const currentHour = Math.floor(now);
  const currentLoad = hourlyLoad[String(currentHour)] ?? 0;
  const { label: currentLabel, cls: currentCls } = getLoadLabel(currentLoad);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Загрузка зала / сегодня</span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className={`text-3xl font-black font-mono ${currentCls}`}>{currentLoad}%</span>
            <span className={`text-[10px] font-bold uppercase tracking-widest ${currentCls}`}>{currentLabel}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {[
            { label: "Спокойно", cls: "bg-peak-low" },
            { label: "Умеренно", cls: "bg-peak-mid" },
            { label: "Загружено", cls: "bg-peak-high" },
            { label: "Пик", cls: "bg-peak-critical" },
          ].map((l) => (
            <span key={l.label} className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
              <span className={`w-2 h-2 rounded-full ${l.cls} inline-block`}></span>{l.label}
            </span>
          ))}
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <div className="absolute left-0 right-0 top-0 bottom-6 flex flex-col justify-between pointer-events-none">
          {[100, 75, 50, 25, 0].map((v) => (
            <div key={v} className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-muted-foreground w-7 text-right shrink-0">{v}</span>
              <div className="flex-1 border-t border-dashed border-[hsl(220_10%_14%)]" />
            </div>
          ))}
        </div>

        <div className="absolute left-9 right-0 bottom-0 top-0 flex items-end gap-1 pb-6">
          {HOURS.map((h, i) => {
            const load = hourlyLoad[String(h)] ?? 0;
            const heightPct = (load / maxLoad) * 100;
            const color = getLoadColor(load);
            const isPast = h < Math.floor(now);
            const isCurrent = h === Math.floor(now);

            return (
              <div key={h} className="flex-1 flex flex-col items-center justify-end h-full group cursor-default relative">
                <div
                  className="w-full rounded-t-[2px] relative transition-all duration-200 group-hover:brightness-125"
                  style={{
                    height: `${heightPct}%`,
                    backgroundColor: color,
                    opacity: isPast ? 0.3 : 1,
                    animationDelay: `${i * 40}ms`,
                  }}
                >
                  {isCurrent && (
                    <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-white pulse-dot" />
                  )}
                  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-[hsl(220_14%_12%)] border border-border rounded px-1.5 py-0.5 text-[10px] font-mono text-foreground whitespace-nowrap z-20">
                    {load}% — {h}:00
                  </div>
                </div>
                <span className={`absolute bottom-0 text-[10px] font-mono ${isCurrent ? "text-primary font-bold" : "text-muted-foreground"}`}>
                  {h}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BookingRow({ r, delay }: { r: Reserve; delay: number }) {
  const isActive = r.is_active;

  return (
    <div
      className={`grid grid-cols-[52px_1fr_10px] gap-3 px-3 py-2.5 rounded-sm border transition-all duration-200 animate-slide-up ${
        isActive
          ? "border-[hsl(43_60%_30%)] bg-[hsl(43_60%_8%/0.6)]"
          : "border-border bg-transparent hover:bg-[hsl(220_12%_12%)]"
      }`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex flex-col justify-center">
        <span className={`font-mono font-bold text-sm leading-tight ${isActive ? "text-primary" : "text-foreground"}`}>{r.time}</span>
        <span className={`text-[9px] uppercase tracking-widest font-bold ${isActive ? "text-peak-mid" : "text-muted-foreground/60"}`}>
          {r.status_label}
        </span>
      </div>

      <div className="flex flex-col justify-center min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-sm text-foreground truncate">{r.name || "—"}</span>
          {r.tags.map((tag) => (
            <span key={tag} className="flex items-center gap-1 bg-[hsl(43_50%_14%)] px-1 py-0.5 rounded-sm shrink-0">
              <span className="text-[9px] text-peak-mid font-medium">{TAG_LABELS[tag] ?? tag}</span>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Icon name="Users" size={10} />{r.guests} гостей
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Icon name="MapPin" size={10} />{r.table}
          </span>
          {r.comment && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-[11px] text-muted-foreground/70 italic truncate max-w-[110px]">{r.comment}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end">
        <div className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-peak-mid pulse-dot" : "bg-[hsl(220_10%_25%)]"}`} />
      </div>
    </div>
  );
}

function SkeletonRows() {
  return (
    <>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="px-3 py-2.5 rounded-sm border border-border bg-[hsl(220_12%_10%)] animate-pulse"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="flex gap-3">
            <div className="w-12 h-8 rounded bg-[hsl(220_10%_16%)]" />
            <div className="flex-1 flex flex-col gap-1.5">
              <div className="h-3.5 w-28 rounded bg-[hsl(220_10%_16%)]" />
              <div className="h-2.5 w-20 rounded bg-[hsl(220_10%_14%)]" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

export default function Index() {
  const time = useCurrentTime();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string>("—");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const fetchData = useCallback(async (showSyncing = false) => {
    if (showSyncing) setSyncing(true);
    try {
      const today = getTodayStr();
      const res = await fetch(`${API_URL}?date=${today}`);
      const json: ApiResponse = await res.json();
      setData(json);
      setError(null);

      const now = new Date();
      setLastSync(now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));

      const notifs: NotificationItem[] = [];

      const loadEntries = Object.entries(json.hourly_load);
      if (loadEntries.length > 0) {
        const peakEntry = loadEntries.reduce((max, cur) => (cur[1] > max[1] ? cur : max));
        if (peakEntry[1] >= 85) {
          notifs.push({ id: 1, text: `Пик загрузки в ${peakEntry[0]}:00 — ${peakEntry[1]}%`, type: "crit" });
        }
      }

      const nowMin = now.getHours() * 60 + now.getMinutes();
      const upcoming30 = json.reserves.filter((r) => {
        const [hh, mm] = r.time.split(":").map(Number);
        const diff = hh * 60 + mm - nowMin;
        return diff > 0 && diff <= 30 && r.guests >= 5;
      });
      if (upcoming30.length > 0) {
        notifs.push({
          id: 2,
          text: `${upcoming30[0].name} — ${upcoming30[0].guests} гостей через ~30 мин`,
          type: "warn",
        });
      }

      notifs.push({
        id: 3,
        text: `Синхронизировано с RESTOPLACE · ${now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`,
        type: "info",
      });

      setNotifications(notifs);
    } catch {
      setError("Не удалось получить данные из RESTOPLACE");
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(), 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const removeNotification = (id: number) => setNotifications((prev) => prev.filter((n) => n.id !== id));

  const reserves = data?.reserves ?? [];
  const hourlyLoad = data?.hourly_load ?? {};
  const stats = data?.stats ?? { total_bookings: 0, total_guests_now: 0, floors: [] };

  const loadValues = Object.values(hourlyLoad);
  const peakLoad = loadValues.length > 0 ? Math.max(...loadValues) : 0;
  const peakHour = Object.entries(hourlyLoad).find(([, v]) => v === peakLoad)?.[0] ?? "—";

  const activeReserves = reserves.filter((r) => r.is_active);
  const upcomingReserves = reserves.filter((r) => !r.is_active);

  return (
    <div className="min-h-screen bg-background font-golos flex flex-col overflow-hidden" style={{ height: "100dvh" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-border bg-[hsl(220_16%_7%)] shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-sm bg-primary flex items-center justify-center">
              <Icon name="ChefHat" size={14} className="text-primary-foreground" />
            </div>
            <div className="flex items-baseline">
              <span className="font-black text-base text-foreground tracking-tight">SWEEP</span>
              <span className="font-black text-base text-primary tracking-tight ml-1">KITCHEN</span>
            </div>
          </div>
          <div className="h-3.5 w-px bg-border" />
          <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">Кухонный монитор</span>
        </div>

        <div className="flex items-center gap-5">
          <div className="text-right">
            <div className="font-mono font-bold text-lg text-foreground leading-none">
              {time.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </div>
            <div className="text-[10px] text-muted-foreground font-mono capitalize">
              {time.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" })}
            </div>
          </div>

          <button
            onClick={() => fetchData(true)}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-border bg-[hsl(220_12%_12%)] hover:border-[hsl(220_10%_24%)] hover:text-foreground transition-all text-[11px] font-medium text-muted-foreground disabled:opacity-60"
          >
            <Icon name="RefreshCw" size={11} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Обновление..." : "Обновить"}
          </button>

          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full pulse-dot ${error ? "bg-peak-critical" : "bg-peak-low"}`} />
            <span className="text-[10px] font-mono text-muted-foreground">RESTOPLACE</span>
          </div>
        </div>
      </header>

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="px-5 py-1.5 flex flex-col gap-1 border-b border-border bg-[hsl(220_14%_8%)] shrink-0">
          {notifications.map((n) => (
            <Notification key={n.id} text={n.text} type={n.type} onClose={() => removeNotification(n.id)} />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-5 py-2 bg-[hsl(0_50%_10%/0.5)] border-b border-[hsl(0_50%_20%)] text-xs text-peak-critical font-mono shrink-0">
          ⚠ {error}
        </div>
      )}

      {/* KPI bar */}
      <div className="grid grid-cols-4 border-b border-border shrink-0">
        {[
          {
            label: "Гостей сейчас",
            value: String(activeReserves.reduce((s, r) => s + r.guests, 0)),
            sub: "в зале",
            icon: "Users",
            cls: "text-peak-mid",
          },
          {
            label: "Броней сегодня",
            value: String(stats.total_bookings),
            sub: "бронирований",
            icon: "CalendarCheck",
            cls: "text-foreground",
          },
          {
            label: "Залы",
            value: String(stats.floors.length),
            sub: stats.floors.slice(0, 2).join(", ") || "—",
            icon: "LayoutGrid",
            cls: "text-peak-low",
          },
          {
            label: "Пик дня",
            value: peakLoad > 0 ? `${peakLoad}%` : "—",
            sub: peakHour !== "—" ? `в ${peakHour}:00` : "нет данных",
            icon: "TrendingUp",
            cls: peakLoad >= 85 ? "text-peak-critical" : "text-peak-mid",
          },
        ].map((kpi, i) => (
          <div key={i} className={`px-5 py-3.5 flex items-center gap-3 ${i < 3 ? "border-r border-border" : ""}`}>
            <div className="w-8 h-8 rounded-sm bg-[hsl(220_12%_13%)] flex items-center justify-center shrink-0">
              <Icon name={kpi.icon as "Users"} size={15} className={kpi.cls} />
            </div>
            <div className="min-w-0">
              <div className={`text-2xl font-black font-mono leading-none ${kpi.cls}`}>{kpi.value}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide truncate">{kpi.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Main */}
      <div className="flex-1 grid grid-cols-[1fr_320px] overflow-hidden">
        {/* Left: Chart + Active */}
        <div className="flex flex-col border-r border-border overflow-hidden">
          <div className="p-5 border-b border-border shrink-0" style={{ height: "240px" }}>
            <LoadChart hourlyLoad={hourlyLoad} />
          </div>

          <div className="flex-1 p-5 overflow-auto">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Сейчас в зале</span>
              <span className="font-mono text-xs font-bold text-peak-mid bg-[hsl(43_60%_12%)] px-2 py-0.5 rounded-sm">
                {activeReserves.length}
              </span>
            </div>
            {loading ? (
              <div className="flex flex-col gap-1"><SkeletonRows /></div>
            ) : activeReserves.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-24 text-muted-foreground text-sm">
                <Icon name="Coffee" size={24} className="mb-2 opacity-30" />
                Нет активных гостей
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {activeReserves.map((r, i) => (
                  <BookingRow key={r.id} r={r} delay={i * 35} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Upcoming */}
        <div className="flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Предстоящие</span>
            <span className="font-mono text-xs font-bold text-primary bg-[hsl(43_60%_12%)] px-2 py-0.5 rounded-sm">
              {upcomingReserves.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1">
            {loading ? (
              <SkeletonRows />
            ) : upcomingReserves.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-24 text-muted-foreground text-sm">
                <Icon name="CalendarX" size={24} className="mb-2 opacity-30" />
                Нет предстоящих броней
              </div>
            ) : (
              upcomingReserves.map((r, i) => (
                <BookingRow key={r.id} r={r} delay={i * 35} />
              ))
            )}
          </div>

          <div className="px-4 py-2.5 border-t border-border bg-[hsl(220_14%_8%)] shrink-0">
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
              <Icon name="Clock" size={10} />
              Обновлено: {lastSync}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
