import type { ChatMessage, Homework, Lesson } from "./types";

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// A student portal access link is a permanent bearer credential (see
// studentAuth.ts), so it needs real cryptographic randomness rather than
// Math.random() — this produces a 192-bit hex token.
export function secureToken(bytes = 24): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const MONTHS_RU = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
export const WEEKDAYS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export const GRADES = ["5 класс", "6 класс", "7 класс", "8 класс", "9 класс", "10 класс", "11 класс"];

export const SUBSCRIPTION_SIZES = [2, 4, 6, 8, 12];

export const LESSON_DURATIONS: { minutes: number; label: string }[] = [
  { minutes: 45, label: "45 мин" },
  { minutes: 60, label: "1 час" },
  { minutes: 90, label: "1,5 часа" },
];

export function durationLabel(minutes: number) {
  return LESSON_DURATIONS.find((d) => d.minutes === minutes)?.label || `${minutes} мин`;
}

export function lessonPillStyle(color: string | null | undefined): { background: string; color: string } | undefined {
  if (!color) return undefined;
  return { background: color + "1A", color };
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

// The date of a student's next non-cancelled lesson after the given one —
// used as the default homework due date ("due by the next lesson").
export function nextLessonDate(lessons: Lesson[], studentId: string, afterDate: string, afterTime: string): string | null {
  const upcoming = lessons
    .filter((l) => l.studentId === studentId && l.status !== "cancelled" && (l.date > afterDate || (l.date === afterDate && l.time > afterTime)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  return upcoming[0]?.date ?? null;
}

// Assigning homework from a lesson creates both the Homework record (due by
// the student's next lesson, linked back to this one) and a chat message
// announcing it, so the student sees it in Сообщения right away.
export function buildHomeworkAssignment(
  lesson: Lesson,
  studentName: string,
  title: string,
  lessons: Lesson[]
): { homework: Homework; message: ChatMessage } {
  const due = nextLessonDate(lessons, lesson.studentId!, lesson.date, lesson.time);
  const homework: Homework = {
    id: uid(),
    studentId: lesson.studentId!,
    studentName,
    title,
    due,
    status: "assigned",
    lessonId: lesson.id,
  };
  const message: ChatMessage = {
    id: uid(),
    from: "me",
    text: due ? `Задано домашнее задание: ${title} (срок: ${fmtDateRu(due)})` : `Задано домашнее задание: ${title}`,
    at: Date.now(),
  };
  return { homework, message };
}

export type RecurrenceFreq = "daily" | "weekly" | "monthly";
export type RecurrenceEnd = "count" | "until" | "endless";

export function buildRecurringDates(
  startDate: string,
  freq: RecurrenceFreq,
  weekdays: number[],
  endType: RecurrenceEnd,
  count: number,
  untilDate: string
): string[] {
  const start = new Date(startDate + "T00:00:00");
  const out: string[] = [];
  const cap = 60;

  if (freq === "daily") {
    const d = new Date(start);
    let n = 0;
    while (n < cap) {
      out.push(dateKey(d));
      n++;
      if (endType === "count" && n >= count) break;
      if (endType === "until" && untilDate && dateKey(d) >= untilDate) break;
      d.setDate(d.getDate() + 1);
      if (endType === "endless" && n >= 24) break;
    }
  } else if (freq === "monthly") {
    const d = new Date(start);
    let n = 0;
    while (n < cap) {
      out.push(dateKey(d));
      n++;
      if (endType === "count" && n >= count) break;
      if (endType === "until" && untilDate && dateKey(d) >= untilDate) break;
      d.setMonth(d.getMonth() + 1);
      if (endType === "endless" && n >= 12) break;
    }
  } else {
    const wdSet = weekdays.length ? weekdays : [(start.getDay() + 6) % 7];
    const d = new Date(start);
    let n = 0;
    let guard = 0;
    while (n < cap && guard < 400) {
      guard++;
      const wd = (d.getDay() + 6) % 7;
      if (wdSet.includes(wd) && d >= start) {
        out.push(dateKey(d));
        n++;
        if (endType === "count" && n >= count) break;
        if (endType === "until" && untilDate && dateKey(d) >= untilDate) break;
        if (endType === "endless" && n >= 24) break;
      }
      d.setDate(d.getDate() + 1);
    }
  }
  return out;
}
