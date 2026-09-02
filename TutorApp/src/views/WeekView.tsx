import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { dateKey, isLessonPast, lessonLabel, lessonPillStyle, paymentStateOf, TODAY, WEEKDAYS_RU } from "../lib/utils";
import type { Lesson, Student } from "../lib/types";
import type { GcalEvent } from "../lib/googleCalendar";

export function startOfWeek(d: Date) {
  const day = (d.getDay() + 6) % 7; // Mon=0
  const s = new Date(d);
  s.setDate(d.getDate() - day);
  s.setHours(0, 0, 0, 0);
  return s;
}

export function getWeekDays(cursor: Date) {
  const start = startOfWeek(cursor);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function addMinutes(time: string, minutes: number) {
  const total = timeToMinutes(time) + minutes;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const HOUR_PX = 52;
const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 21;
const GRID_MAX_HEIGHT = 620;

// Google-Calendar-style side-by-side layout for events that overlap in
// time: each item gets a column index and the total column count for the
// day, so overlapping lessons split the width instead of stacking on top
// of each other. Non-overlapping items all end up in column 0 of 1.
function layoutDayItems<T extends { start: number; end: number }>(items: T[]): (T & { col: number; cols: number })[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end);
  const columnEnds: number[] = [];
  const placed = sorted.map((item) => {
    let col = columnEnds.findIndex((end) => end <= item.start);
    if (col === -1) {
      col = columnEnds.length;
      columnEnds.push(item.end);
    } else {
      columnEnds[col] = item.end;
    }
    return { item, col };
  });
  const cols = Math.max(1, columnEnds.length);
  return placed.map(({ item, col }) => ({ ...item, col, cols }));
}

interface Props {
  cursor: Date;
  lessons: Lesson[];
  students: Student[];
  gcalEvents?: GcalEvent[];
  onDayClick: (date: Date) => void;
  onLessonClick: (lesson: Lesson) => void;
  // The tutor's own schedule pushes cancelled lessons into a slim edge lane
  // so the freed slot reads as bookable. The student portal has no booking
  // action to make room for, so it shows cancellations the classic way
  // instead — grayed out and struck through, sitting in their normal slot.
  classicCancelled?: boolean;
}

export function WeekView({ cursor, lessons, students, gcalEvents = [], onDayClick, onLessonClick, classicCancelled = false }: Props) {
  const days = getWeekDays(cursor);
  const isToday = (d: Date) => dateKey(d) === dateKey(TODAY);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowLabel = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  function lessonAppearance(l: Lesson) {
    const isPast = isLessonPast(l);
    const color = students.find((s) => s.id === l.studentId)?.color;
    const style = lessonPillStyle(color, isPast);
    if (style) return { className: "hover:opacity-80", style };
    const state = paymentStateOf(l);
    if (state === "paid") {
      return {
        className: isPast ? "bg-emerald-200 text-emerald-900 hover:bg-emerald-300" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
        style: undefined,
      };
    }
    if (state === "partial") {
      return {
        className: isPast ? "bg-amber-200 text-amber-900 hover:bg-amber-300" : "bg-amber-50 text-amber-700 hover:bg-amber-100",
        style: undefined,
      };
    }
    return {
      className: isPast ? "bg-blue-200 text-blue-900 hover:bg-blue-300" : "bg-[#EEF2FF] text-[#2563EB] hover:bg-[#E0E9FF]",
      style: undefined,
    };
  }

  const weekKeys = useMemo(() => new Set(days.map(dateKey)), [days]);

  // The grid always covers a comfortable default working window, and
  // widens automatically if a lesson or calendar event falls outside it —
  // so an early-morning or late-evening booking is never clipped.
  const { startHour, endHour } = useMemo(() => {
    let min = DEFAULT_START_HOUR;
    let max = DEFAULT_END_HOUR;
    for (const l of lessons) {
      if (!weekKeys.has(l.date)) continue;
      min = Math.min(min, Math.floor(timeToMinutes(l.time) / 60));
      max = Math.max(max, Math.ceil((timeToMinutes(l.time) + l.duration) / 60));
    }
    for (const e of gcalEvents) {
      if (e.allDay || !e.time || !weekKeys.has(e.date)) continue;
      const endMin = e.endTime ? timeToMinutes(e.endTime) : timeToMinutes(e.time) + 60;
      min = Math.min(min, Math.floor(timeToMinutes(e.time) / 60));
      max = Math.max(max, Math.ceil(endMin / 60));
    }
    return { startHour: Math.max(0, min), endHour: Math.min(24, max) };
  }, [lessons, gcalEvents, weekKeys]);

  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const gridHeight = hours.length * HOUR_PX;
  const topPx = (minutes: number) => ((minutes - startHour * 60) / 60) * HOUR_PX;

  useEffect(() => {
    if (!scrollRef.current) return;
    const target = nowMinutes >= startHour * 60 && nowMinutes <= endHour * 60 ? topPx(nowMinutes) - 80 : 0;
    scrollRef.current.scrollTop = Math.max(0, target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor]);

  return (
    <div>
      <div className="grid grid-cols-[44px_repeat(7,1fr)] sm:grid-cols-[52px_repeat(7,1fr)]">
        <div />
        {days.map((d, i) => (
          <div key={i} className={`text-center py-2.5 border-b border-l border-[#F0F1F4] ${isToday(d) ? "bg-[#EEF2FF]" : "bg-[#FAFBFC]"}`}>
            <div className="text-[10px] sm:text-xs font-semibold text-gray-500">{WEEKDAYS_RU[i]}</div>
            <div
              className={`text-xs sm:text-sm mt-0.5 w-5 h-5 sm:w-6 sm:h-6 mx-auto flex items-center justify-center rounded-full ${
                isToday(d) ? "bg-[#2563EB] text-white font-semibold" : "text-gray-800"
              }`}
            >
              {d.getDate()}
            </div>
          </div>
        ))}
      </div>

      {/* All-day events get their own strip above the timed grid. */}
      {gcalEvents.some((e) => e.allDay && weekKeys.has(e.date)) && (
        <div className="grid grid-cols-[44px_repeat(7,1fr)] sm:grid-cols-[52px_repeat(7,1fr)] border-b border-[#F0F1F4]">
          <div />
          {days.map((d, i) => {
            const key = dateKey(d);
            const allDay = gcalEvents.filter((e) => e.allDay && e.date === key);
            return (
              <div key={i} className="border-l border-[#F0F1F4] p-1 space-y-1">
                {allDay.map((e) => (
                  <a
                    key={e.id}
                    href={e.htmlLink}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-[10px] px-1.5 py-1 rounded-md truncate font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition"
                  >
                    {e.title}
                  </a>
                ))}
              </div>
            );
          })}
        </div>
      )}

      <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: GRID_MAX_HEIGHT }}>
        <div className="grid grid-cols-[44px_repeat(7,1fr)] sm:grid-cols-[52px_repeat(7,1fr)]" style={{ height: gridHeight }}>
          <div className="relative">
            {hours.map((h) => (
              <div key={h} className="absolute right-1.5 -translate-y-1/2 text-[10px] text-gray-400 tabular-nums" style={{ top: topPx(h * 60) }}>
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>
          {days.map((d, i) => {
            const key = dateKey(d);
            const dayLessons = lessons.filter((l) => l.date === key && (classicCancelled || l.status !== "cancelled"));
            const cancelledDayLessons = classicCancelled ? [] : lessons.filter((l) => l.date === key && l.status === "cancelled");
            const dayGcalTimed = gcalEvents.filter((e) => e.date === key && !e.allDay && e.time);
            const todayCol = isToday(d);
            const cancelledLaneWidth = cancelledDayLessons.length > 0 ? 14 : 0;

            type Item =
              | { kind: "lesson"; lesson: Lesson; start: number; end: number }
              | { kind: "gcal"; event: GcalEvent; start: number; end: number };
            const items: Item[] = [
              ...dayLessons.map((lesson): Item => {
                const start = timeToMinutes(lesson.time);
                return { kind: "lesson", lesson, start, end: start + lesson.duration };
              }),
              ...dayGcalTimed.map((event): Item => {
                const start = timeToMinutes(event.time!);
                const end = event.endTime ? timeToMinutes(event.endTime) : start + 60;
                return { kind: "gcal", event, start: Math.max(start, startHour * 60), end };
              }),
            ];
            const positioned = layoutDayItems(items);

            return (
              <div
                key={i}
                onClick={() => onDayClick(d)}
                className="relative border-l border-[#F0F1F4] cursor-pointer hover:bg-[#FAFBFC] transition"
              >
                {hours.map((h) => (
                  <div key={h} className="absolute left-0 right-0 border-t border-[#F0F1F4]" style={{ top: topPx(h * 60) }} />
                ))}

                <div className="absolute inset-0" style={{ right: cancelledLaneWidth }}>
                  {positioned.map((p) => {
                    const widthPct = 100 / p.cols;
                    const leftPct = p.col * widthPct;
                    const heightPx = Math.max(topPx(p.end) - topPx(p.start), 20);
                    const style = {
                      top: topPx(p.start),
                      height: heightPx,
                      left: `calc(${leftPct}% + 1px)`,
                      width: `calc(${widthPct}% - 2px)`,
                    };

                    if (p.kind === "gcal") {
                      return (
                        <a
                          key={`g-${p.event.id}`}
                          href={p.event.htmlLink}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={style}
                          className="absolute flex items-start gap-0.5 text-left text-[10px] px-1.5 py-1 rounded-md font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition overflow-hidden"
                        >
                          <div className="min-w-0 flex-1 truncate">{p.event.title}</div>
                          <ExternalLink size={10} className="shrink-0 mt-0.5" />
                        </a>
                      );
                    }

                    const l = p.lesson;
                    const cancelled = l.status === "cancelled";
                    const appearance = cancelled
                      ? { className: "bg-gray-100 text-gray-400 line-through hover:bg-gray-200", style: undefined }
                      : lessonAppearance(l);
                    const hasCustomColor = !!appearance.style;
                    return (
                      <button
                        key={l.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onLessonClick(l);
                        }}
                        style={{ ...style, ...appearance.style }}
                        className={`absolute text-left text-[10px] leading-tight px-1.5 py-1 rounded-md font-medium transition overflow-hidden ${appearance.className}`}
                      >
                        <div className="flex items-center gap-1">
                          {hasCustomColor && (
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                paymentStateOf(l) === "paid" ? "bg-emerald-500" : paymentStateOf(l) === "partial" ? "bg-amber-400" : "bg-rose-400"
                              }`}
                            />
                          )}
                          <span className="tabular-nums">{heightPx > 40 ? `${l.time}–${addMinutes(l.time, l.duration)}` : l.time}</span>
                        </div>
                        {heightPx > 34 && <div className="truncate">{lessonLabel(l, students)}</div>}
                      </button>
                    );
                  })}
                </div>

                {/* Cancelled lessons are pushed into a slim strip on the edge instead of
                    occupying the main lane, so the freed time slot reads as bookable. */}
                {cancelledDayLessons.map((l) => {
                  const start = timeToMinutes(l.time);
                  const heightPx = Math.max(topPx(start + l.duration) - topPx(start), 14);
                  return (
                    <button
                      key={l.id}
                      title={`${l.time} · ${lessonLabel(l, students)} — отменено`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onLessonClick(l);
                      }}
                      style={{ top: topPx(start), height: heightPx, width: cancelledLaneWidth - 3 }}
                      className="absolute right-0 rounded-sm bg-gray-200 hover:bg-gray-300 transition"
                    />
                  );
                })}

                {todayCol && nowMinutes >= startHour * 60 && nowMinutes <= endHour * 60 && (
                  <div className="absolute left-0 right-0 flex items-center z-10 pointer-events-none" style={{ top: topPx(nowMinutes) - 5 }}>
                    <span className="text-[9px] font-bold text-red-500 bg-white/90 rounded px-0.5 leading-none mr-0.5">{nowLabel}</span>
                    <div className="flex-1 h-[2px] bg-red-500 rounded-full" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
