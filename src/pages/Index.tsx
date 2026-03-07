import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";

const HOURS = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];

const LOAD_DATA: Record<number, number> = {
  10: 12, 11: 28, 12: 72, 13: 95, 14: 88, 15: 60,
  16: 42, 17: 38, 18: 78, 19: 100, 20: 96, 21: 82, 22: 55, 23: 24,
};

const BOOKINGS = [
  { id: 1, time: "12:00", name: "Иванов А.", guests: 4, table: "Стол 3", status: "active", comment: "Аллергия на орехи" },
  { id: 2, time: "12:30", name: "Корпоратив ООО Альфа", guests: 12, table: "Банкет", status: "active", comment: "" },
  { id: 3, time: "13:00", name: "Петрова М.", guests: 2, table: "Стол 7", status: "upcoming", comment: "Вегетарианцы" },
  { id: 4, time: "13:30", name: "Смирнов В.", guests: 6, table: "Терраса", status: "upcoming", comment: "" },
  { id: 5, time: "14:00", name: "Захарова Е.", guests: 3, table: "Стол 1", status: "upcoming", comment: "ДР, торт!" },
  { id: 6, time: "15:00", name: "Козлов Р.", guests: 8, table: "VIP", status: "upcoming", comment: "Постоянный гость" },
  { id: 7, time: "19:00", name: "Новикова С.", guests: 2, table: "Стол 5", status: "upcoming", comment: "" },
  { id: 8, time: "19:30", name: "Бизнес-ужин", guests: 5, table: "Кабинет", status: "upcoming", comment: "" },
];

const TABLES = [
  { id: 1, name: "Стол 1", capacity: 4, status: "booked", load: 75 },
  { id: 2, name: "Стол 3", capacity: 4, status: "busy", load: 100 },
  { id: 3, name: "Стол 5", capacity: 2, status: "free", load: 0 },
  { id: 4, name: "Стол 7", capacity: 2, status: "free", load: 0 },
  { id: 5, name: "Терраса", capacity: 8, status: "booked", load: 75 },
  { id: 6, name: "Банкет", capacity: 20, status: "busy", load: 60 },
  { id: 7, name: "VIP", capacity: 10, status: "booked", load: 80 },
  { id: 8, name: "Кабинет", capacity: 6, status: "free", load: 0 },
];

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

function getTableStatusColor(status: string): string {
  if (status === "free") return "hsl(220 12% 11%)";
  if (status === "booked") return "hsl(43 60% 12%)";
  return "hsl(16 50% 13%)";
}

function getTableStatusLabel(status: string): { label: string; cls: string } {
  if (status === "free") return { label: "Свободен", cls: "text-muted-foreground" };
  if (status === "booked") return { label: "Забронирован", cls: "text-peak-mid" };
  return { label: "Занят", cls: "text-peak-high" };
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

function LoadChart() {
  const now = getNow();
  const maxLoad = Math.max(...Object.values(LOAD_DATA));
  const currentHour = Math.floor(now);
  const currentLoad = LOAD_DATA[currentHour] || 0;
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
            const load = LOAD_DATA[h] || 0;
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

function BookingRow({ b, delay }: { b: typeof BOOKINGS[0]; delay: number }) {
  const isActive = b.status === "active";
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
        <span className={`font-mono font-bold text-sm leading-tight ${isActive ? "text-primary" : "text-foreground"}`}>{b.time}</span>
        {isActive && <span className="text-[9px] uppercase tracking-widest text-peak-mid font-bold">сейчас</span>}
      </div>

      <div className="flex flex-col justify-center min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-sm text-foreground truncate">{b.name}</span>
          {b.comment && (
            <span className="flex items-center gap-1 bg-[hsl(43_50%_14%)] px-1 py-0.5 rounded-sm shrink-0">
              <Icon name="AlertCircle" size={9} className="text-peak-mid" />
              <span className="text-[9px] text-peak-mid font-medium max-w-[100px] truncate">{b.comment}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Icon name="Users" size={10} />{b.guests} гостей
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Icon name="MapPin" size={10} />{b.table}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-end">
        <div className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-peak-mid pulse-dot" : "bg-[hsl(220_10%_25%)]"}`} />
      </div>
    </div>
  );
}

function TableCard({ t, delay }: { t: typeof TABLES[0]; delay: number }) {
  const { label, cls } = getTableStatusLabel(t.status);

  return (
    <div
      className="rounded-sm border border-border p-3 flex flex-col gap-2 animate-fade-in hover:border-[hsl(220_10%_22%)] transition-all cursor-default"
      style={{ animationDelay: `${delay}ms`, backgroundColor: getTableStatusColor(t.status) }}
    >
      <div className="flex items-center justify-between">
        <span className="font-bold text-sm text-foreground">{t.name}</span>
        <span className="text-[10px] font-mono text-muted-foreground">{t.capacity}м</span>
      </div>
      <span className={`text-[10px] font-semibold uppercase tracking-wider ${cls}`}>{label}</span>
      {t.load > 0 && (
        <div className="h-px bg-[hsl(220_10%_20%)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${t.load}%`, backgroundColor: getLoadColor(t.load) }}
          />
        </div>
      )}
    </div>
  );
}

export default function Index() {
  const time = useCurrentTime();
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    { id: 1, text: "Пик загрузки ожидается в 19:00–20:00 (100%)", type: "crit" },
    { id: 2, text: "Корпоратив на 12 чел. начинается через 30 мин", type: "warn" },
    { id: 3, text: "Синхронизировано с RESTOPLACE · 2 мин назад", type: "info" },
  ]);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState("2 мин назад");

  const removeNotification = (id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleSync = () => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      setLastSync("только что");
      setNotifications((prev) => {
        const filtered = prev.filter((n) => n.type !== "info");
        return [{ id: Date.now(), text: "Синхронизировано с RESTOPLACE · только что", type: "info" as const }, ...filtered];
      });
    }, 1800);
  };

  const activeBookings = BOOKINGS.filter((b) => b.status === "active");
  const totalGuests = activeBookings.reduce((s, b) => s + b.guests, 0);
  const freeTables = TABLES.filter((t) => t.status === "free").length;
  const peakLoad = Math.max(...Object.values(LOAD_DATA));
  const currentHour = Math.floor(getNow());
  const currentLoad = LOAD_DATA[currentHour] || 0;

  return (
    <div className="min-h-screen bg-background font-golos flex flex-col overflow-hidden" style={{ height: "100dvh" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-border bg-[hsl(220_16%_7%)] shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-sm bg-primary flex items-center justify-center">
              <Icon name="ChefHat" size={14} className="text-primary-foreground" />
            </div>
            <div className="flex items-baseline gap-0.5">
              <span className="font-black text-base text-foreground tracking-tight">SWEEP</span>
              <span className="font-black text-base text-primary tracking-tight ml-1"> KITCHEN</span>
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
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-border bg-[hsl(220_12%_12%)] hover:border-[hsl(220_10%_24%)] hover:text-foreground transition-all text-[11px] font-medium text-muted-foreground disabled:opacity-60"
          >
            <Icon name="RefreshCw" size={11} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Синхронизация..." : "Обновить"}
          </button>

          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-peak-low pulse-dot" />
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

      {/* KPI bar */}
      <div className="grid grid-cols-4 border-b border-border shrink-0">
        {[
          { label: "Гостей сейчас", value: String(totalGuests), sub: "в зале", icon: "Users", cls: "text-peak-mid" },
          { label: "Броней сегодня", value: String(BOOKINGS.length), sub: "бронирований", icon: "CalendarCheck", cls: "text-foreground" },
          { label: "Свободных столов", value: String(freeTables), sub: `из ${TABLES.length}`, icon: "LayoutGrid", cls: "text-peak-low" },
          { label: "Пик дня", value: `${peakLoad}%`, sub: "в 19:00", icon: "TrendingUp", cls: "text-peak-critical" },
        ].map((kpi, i) => (
          <div key={i} className={`px-5 py-3.5 flex items-center gap-3 ${i < 3 ? "border-r border-border" : ""}`}>
            <div className="w-8 h-8 rounded-sm bg-[hsl(220_12%_13%)] flex items-center justify-center shrink-0">
              <Icon name={kpi.icon as "Users"} size={15} className={kpi.cls} />
            </div>
            <div>
              <div className={`text-2xl font-black font-mono leading-none ${kpi.cls}`}>{kpi.value}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">{kpi.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Main */}
      <div className="flex-1 grid grid-cols-[1fr_320px] overflow-hidden">
        {/* Left */}
        <div className="flex flex-col border-r border-border overflow-hidden">
          {/* Chart */}
          <div className="p-5 border-b border-border shrink-0" style={{ height: "240px" }}>
            <LoadChart />
          </div>

          {/* Tables */}
          <div className="flex-1 p-5 overflow-auto">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Карта столиков</span>
              <div className="flex items-center gap-3">
                {[
                  { label: "Свободен", color: "hsl(220 12% 22%)" },
                  { label: "Забронирован", color: "hsl(43 70% 40%)" },
                  { label: "Занят", color: "hsl(16 80% 45%)" },
                ].map((l) => (
                  <span key={l.label} className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: l.color }}></span>{l.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {TABLES.map((t, i) => (
                <TableCard key={t.id} t={t} delay={i * 50} />
              ))}
            </div>
          </div>
        </div>

        {/* Right: Bookings */}
        <div className="flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Бронирования</span>
            <span className="font-mono text-xs font-bold text-primary bg-[hsl(43_60%_12%)] px-2 py-0.5 rounded-sm">{BOOKINGS.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1">
            {BOOKINGS.map((b, i) => (
              <BookingRow key={b.id} b={b} delay={i * 35} />
            ))}
          </div>

          <div className="px-4 py-2.5 border-t border-border bg-[hsl(220_14%_8%)] shrink-0">
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
              <Icon name="Clock" size={10} />
              Последнее обновление: {lastSync}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
