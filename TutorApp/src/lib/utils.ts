import type { Attachment, ChatMessage, Homework, HomeworkStatus, Lesson, MethodNote, MethodNoteAttachments, Student } from "./types";
import type { Updater } from "./storage";

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// Homework records created before the assigned/submitted/done split still
// carry the old "pending" status string in stored data. Normalize any
// unrecognized value to "assigned" (closest equivalent — under the old
// model nothing moved to "done" without the tutor confirming it) so status
// lookups never index a map with an unknown key and crash.
export function normalizeHomeworkStatus(status: string): HomeworkStatus {
  return status === "submitted" || status === "done" || status === "assigned" ? status : "assigned";
}

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

// Russian plural forms: pluralRu(1, ["занятие", "занятия", "занятий"]) → "занятие".
export function pluralRu(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}

// Past lessons get a noticeably darker/more saturated tint than upcoming
// ones, so already-happened lessons are distinguishable at a glance.
export function lessonPillStyle(color: string | null | undefined, past = false): { background: string; color: string } | undefined {
  if (!color) return undefined;
  return { background: color + (past ? "40" : "1A"), color };
}

// What to show on a lesson pill in the calendar — the student's name plus
// their grade, so a tutor scanning the week can tell classes apart without
// opening each lesson. Group lessons and lessons for students without a
// grade on file just fall back to the lesson's own title.
//
// `lesson.title` is a one-time snapshot of the student's name taken when
// the lesson was created, not a live reference — so it goes stale if the
// student is later renamed. Prefer the current name from `students` and
// only fall back to the stored title (group lessons, or a student that's
// since been deleted).
export function lessonLabel(lesson: Lesson, students: Student[]): string {
  const student = lesson.studentId ? students.find((s) => s.id === lesson.studentId) : undefined;
  const name = student?.name || lesson.title;
  return student?.grade ? `${name} · ${student.grade}` : name;
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

// A lesson counts as "conducted" once it has actually ended — comparing
// only dates would mark a lesson later today as past the moment the date
// rolls over, hours before the tutor has even taught it.
export function isLessonPast(lesson: { date: string; time: string; duration: number }, now: Date = new Date()): boolean {
  const [y, mo, d] = lesson.date.split("-").map(Number);
  const [h, m] = lesson.time.split(":").map(Number);
  const end = new Date(y, mo - 1, d, h, m || 0);
  end.setMinutes(end.getMinutes() + (lesson.duration || 0));
  return end.getTime() <= now.getTime();
}

export function sumPrice(list: { price: number }[]) {
  return list.reduce((s, l) => s + (Number(l.price) || 0), 0);
}

type PayableLesson = { price: number; paymentStatus: string; paidAmount?: number };

// Amount actually paid toward a lesson's price. Lessons saved before partial
// payment support only ever recorded the all-or-nothing paymentStatus flag,
// so paidAmount is optional — fall back to deriving it from that flag.
export function paidAmountOf(l: PayableLesson): number {
  if (l.paidAmount != null) return l.paidAmount;
  return l.paymentStatus === "paid" ? Number(l.price) || 0 : 0;
}

// What's still owed on this lesson — never negative (an overpayment isn't a debt).
export function remainingAmountOf(l: PayableLesson): number {
  return Math.max(0, (Number(l.price) || 0) - paidAmountOf(l));
}

export type PaymentState = "paid" | "pending";

// Payment is strictly all-or-nothing — a lesson paid for only in part (from
// before this was removed as an option) still counts as unpaid here, same as
// one never paid at all; what's actually been paid toward it stays visible
// via paidAmountOf/remainingAmountOf for balance totals.
export function paymentStateOf(l: PayableLesson): PaymentState {
  const price = Number(l.price) || 0;
  return price <= 0 || paidAmountOf(l) >= price ? "paid" : "pending";
}

// Adjacent lessons for the same student, in chronological order — powers
// the "◀ Предыдущий / Следующий ▶" navigation inside the lesson modal, so
// the tutor can page through one student's lessons without closing it.
export function adjacentLessons(lessons: Lesson[], current: Lesson): { prev: Lesson | null; next: Lesson | null } {
  const sameStudent = lessons
    .filter((l) => l.studentId === current.studentId)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  const idx = sameStudent.findIndex((l) => l.id === current.id);
  if (idx === -1) return { prev: null, next: null };
  return {
    prev: idx > 0 ? sameStudent[idx - 1] : null,
    next: idx < sameStudent.length - 1 ? sameStudent[idx + 1] : null,
  };
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
  lessons: Lesson[],
  opts?: { due?: string; attachments?: Attachment[] }
): { homework: Homework; message: ChatMessage } {
  const due = opts?.due || nextLessonDate(lessons, lesson.studentId!, lesson.date, lesson.time);
  const homework: Homework = {
    id: uid(),
    studentId: lesson.studentId!,
    studentName,
    title,
    due,
    status: "assigned",
    createdAt: Date.now(),
    lessonId: lesson.id,
    noteId: lesson.noteId,
    attachments: opts?.attachments?.length ? opts.attachments : undefined,
  };
  const message: ChatMessage = {
    id: uid(),
    from: "me",
    text: due ? `Задано домашнее задание: ${title} (срок: ${fmtDateRu(due)})` : `Задано домашнее задание: ${title}`,
    at: Date.now(),
  };
  return { homework, message };
}

// A homework attachment is also useful as reference material for the topic
// itself — e.g. a worksheet photo attached once should show up in every
// future lesson on that topic, not just this one assignment. Copies (never
// moves) the homework's files into the linked note's own Д/З attachments
// (MethodNote.attachments.homework), deduped by attachment id so calling
// this again for the same homework (e.g. after an edit) doesn't pile up
// duplicates. No-ops when the homework has no linked topic or no files.
export function syncHomeworkAttachmentsToNote(homework: Homework, notes: MethodNote[], saveNotes: (next: Updater<MethodNote[]>) => void): void {
  if (!homework.noteId || !homework.attachments?.length) return;
  const note = notes.find((n) => n.id === homework.noteId);
  if (!note) return;
  const existing = note.attachments?.homework || [];
  const existingIds = new Set(existing.map((a) => a.id));
  if (!homework.attachments.some((a) => !existingIds.has(a.id))) return;

  const noteId = note.id;
  const files = homework.attachments;
  // Recomputed against fresh data on a stale-write retry (see Updater in
  // lib/storage.ts) rather than closing over this render's `notes` — the
  // dedup above is just an early exit so a no-op call skips scheduling a
  // write at all.
  saveNotes((notes) => {
    const current = notes.find((n) => n.id === noteId);
    if (!current) return notes;
    const currentExisting = current.attachments?.homework || [];
    const currentExistingIds = new Set(currentExisting.map((a) => a.id));
    const newFiles = files.filter((a) => !currentExistingIds.has(a.id));
    if (newFiles.length === 0) return notes;
    const nextAttachments: MethodNoteAttachments = { ...(current.attachments || {}), homework: [...currentExisting, ...newFiles] };
    return notes.map((n) => (n.id === noteId ? { ...n, attachments: nextAttachments, updatedAt: Date.now() } : n));
  });
}

// Every file a methodology topic has, across all its tabs (theory, rules,
// tasks, test, homework) — not just the ones filed under "homework". In
// practice a tutor attaches a worksheet or photo to whichever tab she
// happens to be on while teaching (usually Theory/Rules), not necessarily
// the Д/З tab, so offering only `attachments.homework` when assigning
// homework left most of a topic's files impossible to find or attach there.
export function allNoteAttachments(note: MethodNote | null | undefined): Attachment[] {
  if (!note?.attachments) return [];
  const seen = new Set<string>();
  const result: Attachment[] = [];
  for (const files of Object.values(note.attachments)) {
    for (const a of files || []) {
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      result.push(a);
    }
  }
  return result;
}

// Topics for one grade+subject, in the order they're stored — NotesView
// never resorts them client-side, so storage order *is* topic order (e.g.
// "1. ...", "2. ..."), and this relies on that same convention.
export function topicsForSubject(notes: MethodNote[], grade: string | undefined, subject: string): MethodNote[] {
  return notes.filter((n) => n.grade === grade && n.subject === subject);
}

// Advances a student's topic cycle by one turn — used once per lesson being
// created, in date order. Returns the topic to assign to that lesson (the
// subject whose turn it is, at wherever that subject's list had gotten to)
// and the updated cycle to persist for next time. Wraps back to the first
// topic once a subject's list is exhausted, rather than assigning nothing.
export function advanceTopicCycle(
  cycle: NonNullable<Student["topicCycle"]>,
  notes: MethodNote[],
  grade: string | undefined
): { noteId: string | undefined; cycle: NonNullable<Student["topicCycle"]> } {
  if (cycle.subjects.length === 0) return { noteId: undefined, cycle };
  const subject = cycle.subjects[cycle.nextIndex % cycle.subjects.length];
  const topics = topicsForSubject(notes, grade, subject);
  const noteId = cycle.cursors[subject];
  const idx = noteId ? topics.findIndex((t) => t.id === noteId) : -1;
  const nextId = topics.length ? topics[(idx + 1) % topics.length]?.id : undefined;
  return {
    noteId,
    cycle: { ...cycle, nextIndex: (cycle.nextIndex + 1) % cycle.subjects.length, cursors: { ...cycle.cursors, [subject]: nextId } },
  };
}

// Homework is created from two different places (this file's own
// buildHomeworkAssignment and HomeworkView's standalone "Задать ДЗ") that
// don't agree on whether new items get appended or prepended to the stored
// array, so array order alone was never a reliable stand-in for "newest
// first" — sort by the actual createdAt instead. Records saved before this
// field existed sort as if createdAt were 0 (oldest), which — since
// Array.prototype.sort is stable — keeps their relative order but places
// them after every timestamped record.
export function sortHomeworkNewestFirst<T extends { createdAt?: number }>(list: T[]): T[] {
  return [...list].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
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
