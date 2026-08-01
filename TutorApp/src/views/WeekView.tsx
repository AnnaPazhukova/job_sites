import { ExternalLink } from "lucide-react";
import { dateKey, isLessonPast, lessonPillStyle, TODAY, WEEKDAYS_RU } from "../lib/utils";
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

interface Props {
  cursor: Date;
  lessons: Lesson[];
  students: Student[];
  gcalEvents?: GcalEvent[];
  onDayClick: (date: Date) => void;
  onLessonClick: (lesson: Lesson) => void;
}

export function WeekView({ cursor, lessons, students, gcalEvents = [], onDayClick, onLessonClick }: Props) {
  const days = getWeekDays(cursor);
  const isToday = (d: Date) => dateKey(d) === dateKey(TODAY);

  function lessonAppearance(l: Lesson) {
    if (l.status === "cancelled") return { className: "bg-gray-100 text-gray-400 line-through", style: undefined };
    const isPast = isLessonPast(l);
    const color = students.find((s) => s.id === l.studentId)?.color;
    const style = lessonPillStyle(color, isPast);
    if (style) return { className: "hover:opacity-80", style };
    if (l.paymentStatus === "paid") {
      return {
        className: isPast ? "bg-emerald-200 text-emerald-900 hover:bg-emerald-300" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
        style: undefined,
      };
    }
    return {
      className: isPast ? "bg-blue-200 text-blue-900 hover:bg-blue-300" : "bg-[#EEF2FF] text-[#2563EB] hover:bg-[#E0E9FF]",
      style: undefined,
    };
  }

  return (
    <div className="grid grid-cols-7 divide-x divide-[#F0F1F4]">
      {days.map((d, i) => {
        const key = dateKey(d);
        const dayLessons = lessons.filter((l) => l.date === key).sort((a, b) => a.time.localeCompare(b.time));
        const dayGcal = gcalEvents.filter((e) => e.date === key).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
        return (
          <div key={i} className="min-h-[440px] flex flex-col">
            <div className={`text-center py-3 border-b border-[#F0F1F4] ${isToday(d) ? "bg-[#EEF2FF]" : "bg-[#FAFBFC]"}`}>
              <div className="text-xs font-semibold text-gray-500">{WEEKDAYS_RU[i]}</div>
              <div
                className={`text-sm mt-0.5 w-6 h-6 mx-auto flex items-center justify-center rounded-full ${isToday(d) ? "bg-[#2563EB] text-white font-semibold" : "text-gray-800"}`}
              >
                {d.getDate()}
              </div>
            </div>
            <div onClick={() => onDayClick(d)} className="flex-1 p-1.5 space-y-1.5 cursor-pointer hover:bg-[#FAFBFC] transition">
              {dayGcal.map((e) => (
                <a
                  key={e.id}
                  href={e.htmlLink}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(ev) => ev.stopPropagation()}
                  className="w-full flex items-start gap-1 text-left text-[11px] px-2 py-1.5 rounded-lg font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition"
                >
                  <div className="min-w-0 flex-1">
                    <div>{e.allDay ? "Весь день" : `${e.time}–${e.endTime || ""}`}</div>
                    <div className="truncate">{e.title}</div>
                  </div>
                  <ExternalLink size={11} className="shrink-0 mt-0.5" />
                </a>
              ))}
              {dayLessons.map((l) => {
                const appearance = lessonAppearance(l);
                const hasCustomColor = !!appearance.style;
                return (
                  <button
                    key={l.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onLessonClick(l);
                    }}
                    style={appearance.style}
                    className={`w-full text-left text-[11px] px-2 py-1.5 rounded-lg font-medium transition ${appearance.className}`}
                  >
                    <div className="flex items-center gap-1">
                      {hasCustomColor && l.status !== "cancelled" && (
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${l.paymentStatus === "paid" ? "bg-emerald-500" : "bg-rose-400"}`} />
                      )}
                      {l.time}–{addMinutes(l.time, l.duration)}
                    </div>
                    <div className="truncate">{l.title}</div>
                  </button>
                );
              })}
              {dayLessons.length === 0 && dayGcal.length === 0 && <div className="text-center text-[11px] text-gray-300 pt-4">Пусто</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
