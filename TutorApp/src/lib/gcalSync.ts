// Two-way, create-only sync between a tutor's chosen Google Calendar and
// their `lessons` list. Deliberately never edits or deletes on either side
// (see the "Explicitly not touched" note in the plan this shipped from) —
// worst case is a duplicate/mismatched lesson the tutor fixes by hand,
// never silently altered or lost data. Runs client-side only, triggered by
// ScheduleView (manual button + auto-interval while the page is open).

import { createGoogleEvent, fetchGoogleEvents, type GcalEvent } from "./googleCalendar";
import { dateKey, matchStudentByNameAndGrade, uid } from "./utils";
import type { Lesson, Student } from "./types";

const WINDOW_DAYS_PAST = 7;
const WINDOW_DAYS_FUTURE = 90;

function syncWindow(): { start: Date; end: Date } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - WINDOW_DAYS_PAST);
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() + WINDOW_DAYS_FUTURE);
  return { start, end };
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function eventDuration(e: GcalEvent): number {
  if (!e.time || !e.endTime) return 60;
  const mins = timeToMinutes(e.endTime) - timeToMinutes(e.time);
  return mins > 0 ? mins : 60;
}

export interface GcalSyncResult {
  lessons: Lesson[];
  imported: number;
  exported: number;
}

export async function runGcalSync(opts: {
  token: string;
  calendarId: string;
  timeZone: string;
  lessons: Lesson[];
  students: Student[];
}): Promise<GcalSyncResult> {
  const { token, calendarId, timeZone } = opts;
  let lessons = opts.lessons;
  const { start, end } = syncWindow();
  const startKey = dateKey(start);
  const endKey = dateKey(end);

  // Export first: lessons in the window with no linked event yet, so the
  // events they create are already tagged before the import pass below
  // runs — otherwise a lesson exported in this same sync would come right
  // back as a duplicate import a few lines down.
  const toExport = lessons.filter((l) => !l.gcalEventId && l.status !== "cancelled" && l.date >= startKey && l.date <= endKey);
  let exported = 0;
  for (const lesson of toExport) {
    try {
      const eventId = await createGoogleEvent(token, calendarId, {
        summary: lesson.title,
        date: lesson.date,
        time: lesson.time,
        duration: lesson.duration,
        timeZone,
        tutorspaceLessonId: lesson.id,
      });
      lessons = lessons.map((l) => (l.id === lesson.id ? { ...l, gcalEventId: eventId } : l));
      exported++;
    } catch {
      // Leave this one for the next sync pass rather than aborting the rest.
    }
  }

  // Import: events in the window that aren't already tagged as ours and
  // aren't already linked to an existing lesson.
  const linkedEventIds = new Set(lessons.map((l) => l.gcalEventId).filter(Boolean));
  const events = await fetchGoogleEvents(token, calendarId, start.toISOString(), end.toISOString());
  const toImport = events.filter((e) => !e.allDay && e.time && !e.tutorspaceLessonId && !linkedEventIds.has(e.id));

  const imported: Lesson[] = toImport.map((e) => {
    const student = matchStudentByNameAndGrade(e.title, opts.students);
    return {
      id: uid(),
      studentId: student?.id,
      title: student?.name || e.title,
      date: e.date,
      time: e.time!,
      duration: eventDuration(e),
      price: student?.rate || 0,
      status: "scheduled",
      paymentStatus: "pending",
      gcalEventId: e.id,
    };
  });

  return { lessons: [...lessons, ...imported], imported: imported.length, exported };
}
