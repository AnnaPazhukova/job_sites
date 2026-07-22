export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const MONTHS_RU = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
export const WEEKDAYS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export const LESSON_DURATIONS: { minutes: number; label: string }[] = [
  { minutes: 45, label: "45 мин" },
  { minutes: 60, label: "1 час" },
  { minutes: 90, label: "1,5 часа" },
];

export function durationLabel(minutes: number) {
  return LESSON_DURATIONS.find((d) => d.minutes === minutes)?.label || `${minutes} мин`;
}

const AVATAR_COLORS = ["#2563EB", "#059669", "#D97706", "#DC2626", "#7C3AED", "#0891B2", "#DB2777"];

export function colorFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export function fmtMoney(n: number) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " ₽";
}

function pad(n: number) {
  return n < 10 ? "0" + n : "" + n;
}

export function dateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fmtDateRu(key: string | null | undefined) {
  if (!key) return "—";
  const [y, m, d] = key.split("-");
  return `${d}.${m}.${y}`;
}

export const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);
export const TODAY_KEY = dateKey(TODAY);

export function sumPrice(list: { price: number }[]) {
  return list.reduce((s, l) => s + (Number(l.price) || 0), 0);
}
