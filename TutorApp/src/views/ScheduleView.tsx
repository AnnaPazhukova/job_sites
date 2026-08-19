import { useMemo, useState } from "react";
import { AlertTriangle, Calendar as CalendarIcon, CalendarClock, CalendarPlus, CalendarCheck2, Check, ChevronLeft, ChevronRight, Clock, Plus, Wallet, X } from "lucide-react";
import { Avatar, Card, Field, Modal, PageHeader, PrimaryButton, RecurrenceFields, TextInput } from "../components/ui";
import {
  adjacentLessons,
  buildHomeworkAssignment,
  buildRecurringDates,
  dateKey,
  fmtDateRu,
  isLessonPast,
  lessonLabel,
  lessonPillStyle,
  MONTHS_RU,
  pluralRu,
  TODAY,
  WEEKDAYS_RU,
  uid,
  type RecurrenceEnd,
  type RecurrenceFreq,
} from "../lib/utils";
import type { Group, Homework, Lesson, MessagesByStudent, MethodNote, Student, WeeklyTemplateSlot } from "../lib/types";
import type { GcalEvent } from "../lib/googleCalendar";
import { useGoogleCalendar } from "../lib/useGoogleCalendar";
import { MiniCalendar } from "../components/MiniCalendar";
import { LessonFormModal } from "./StudentDetailView";
import { StudentBalances } from "./StudentBalances";
import { WeekView, getWeekDays } from "./WeekView";
import { WeeklyTemplateModal } from "./WeeklyTemplateModal";

type DayItem = { kind: "gcal"; e: GcalEvent } | { kind: "lesson"; l: Lesson };

interface Props {
  lessons: Lesson[];
  setLessons: (l: Lesson[]) => void;
  students: Student[];
  setStudents: (s: Student[]) => void;
  groups: Group[];
  weeklyTemplate: WeeklyTemplateSlot[];
  setWeeklyTemplate: (t: WeeklyTemplateSlot[]) => void;
  homework: Homework[];
  setHomework: (h: Homework[]) => void;
  messages: MessagesByStudent;
  setMessages: (m: MessagesByStudent) => void;
  notes: MethodNote[];
  showToast: (t: string) => void;
}

export function ScheduleView({
  lessons,
  setLessons,
  students,
  setStudents,
  groups,
  weeklyTemplate,
  setWeeklyTemplate,
  homework,
  setHomework,
  messages,
  setMessages,
  notes,
  showToast,
}: Props) {
  const [mode, setMode] = useState<"month" | "week" | "day">("month");
  const [cursor, setCursor] = useState(TODAY);
  const [showAdd, setShowAdd] = useState(false);
  const [addDate, setAddDate] = useState<Date | null>(null);
  const [editLesson, setEditLesson] = useState<Lesson | null>(null);
  const [showTemplate, setShowTemplate] = useState(false);
  const [studentFilter, setStudentFilter] = useState("");

  const displayedLessons = studentFilter ? lessons.filter((l) => l.studentId === studentFilter) : lessons;

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() + 6) % 7; // Monday=0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev = new Date(year, month, 0).getDate();
    const arr: { day: number; current: boolean; date: Date }[] = [];
    for (let i = startOffset - 1; i >= 0; i--) arr.push({ day: daysInPrev - i, current: false, date: new Date(year, month - 1, daysInPrev - i) });
    for (let d = 1; d <= daysInMonth; d++) arr.push({ day: d, current: true, date: new Date(year, month, d) });
    while (arr.length % 7 !== 0) {
      const d = arr.length - (startOffset + daysInMonth) + 1;
      arr.push({ day: d, current: false, date: new Date(year, month + 1, d) });
    }
    return arr;
  }, [year, month]);

  const isToday = (d: Date) => dateKey(d) === dateKey(TODAY);

  const rangeStartISO = useMemo(() => {
    const base = mode === "month" ? cells[0]?.date : mode === "week" ? getWeekDays(cursor)[0] : cursor;
    const d = new Date(base || cursor);
    d.setDate(d.getDate() - 1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, [mode, cells, cursor]);

  const rangeEndISO = useMemo(() => {
    const base = mode === "month" ? cells[cells.length - 1]?.date : mode === "week" ? getWeekDays(cursor)[6] : cursor;
    const d = new Date(base || cursor);
    d.setDate(d.getDate() + 2);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, [mode, cells, cursor]);

  const gcal = useGoogleCalendar(rangeStartISO, rangeEndISO);

  function itemsOn(d: Date): DayItem[] {
    const key = dateKey(d);
    const gcalItems: DayItem[] = gcal.events.filter((e) => e.date === key).map((e) => ({ kind: "gcal", e }));
    const lessonItems: DayItem[] = displayedLessons.filter((l) => l.date === key).map((l) => ({ kind: "lesson", l }));
    return [...gcalItems, ...lessonItems];
  }

  function lessonAppearance(l: Lesson) {
    if (l.status === "cancelled") return { className: "bg-gray-100 text-gray-400 line-through", style: undefined };
    const isPast = isLessonPast(l);
    const color = students.find((s) => s.id === l.studentId)?.color;
    const style = lessonPillStyle(color, isPast);
    if (style) return { className: "hover:opacity-80", style };
    return isPast
      ? { className: "bg-blue-100 text-blue-800 hover:bg-blue-200", style: undefined }
      : { className: "bg-[#EEF2FF] text-[#2563EB] hover:bg-[#E0E9FF]", style: undefined };
  }

  function openAdd(date: Date) {
    setAddDate(date);
    setShowAdd(true);
  }

  function addLesson(data: Partial<Lesson> & { occurrences?: string[] }) {
    const { occurrences, ...base } = data;
    const dates = occurrences && occurrences.length ? occurrences : [base.date as string];
    const created: Lesson[] = dates.map((date) => ({
      ...(base as Omit<Lesson, "id" | "date" | "status" | "paymentStatus">),
      id: uid(),
      date,
      status: "scheduled",
      paymentStatus: "pending",
    }));
    setLessons([...lessons, ...created]);
    setShowAdd(false);
    showToast(created.length > 1 ? `Добавлено занятий: ${created.length}` : "Занятие добавлено в расписание");
  }

  function saveLessonEdit(data: Partial<Lesson>) {
    setLessons(lessons.map((l) => (l.id === data.id ? { ...l, ...data } : l)));
    showToast("Занятие обновлено");
    setEditLesson(null);
  }

  function cancelLessonEdit(id: string) {
    setLessons(lessons.map((l) => (l.id === id ? { ...l, status: "cancelled" } : l)));
    showToast("Занятие отменено");
    setEditLesson(null);
  }

  function approveCancelRequest(id: string) {
    setLessons(lessons.map((l) => (l.id === id ? { ...l, status: "cancelled" as const, cancelRequested: false } : l)));
    showToast("Занятие отменено");
  }

  function declineCancelRequest(id: string) {
    setLessons(lessons.map((l) => (l.id === id ? { ...l, cancelRequested: false } : l)));
    showToast("Запрос на отмену отклонён");
  }

  function moveLesson(id: string, date: string, time: string) {
    setLessons(lessons.map((l) => (l.id === id ? { ...l, date, time } : l)));
    showToast("Занятие перенесено");
    setEditLesson(null);
  }

  function handleAssignHomework(title: string, noteId?: string) {
    if (!editLesson || !editLesson.studentId) return;
    const st = students.find((s) => s.id === editLesson.studentId);
    const { homework: hw, message } = buildHomeworkAssignment({ ...editLesson, noteId }, st?.name || editLesson.title, title, lessons);
    setHomework([...homework, hw]);
    setMessages({ ...messages, [editLesson.studentId]: [...(messages[editLesson.studentId] || []), message] });
    showToast("Домашнее задание задано");
  }

  function handleUpdateHomework(id: string, patch: Partial<Homework>) {
    setHomework(homework.map((h) => (h.id === id ? { ...h, ...patch } : h)));
    showToast("Домашнее задание обновлено");
  }

  function goPrev() {
    if (mode === "month") setCursor(new Date(year, month - 1, 1));
    else if (mode === "week") setCursor(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 7));
    else setCursor(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1));
  }

  function goNext() {
    if (mode === "month") setCursor(new Date(year, month + 1, 1));
    else if (mode === "week") setCursor(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7));
    else setCursor(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1));
  }

  function applyWeeklyTemplate() {
    const days = getWeekDays(cursor);
    let created = 0;
    const next: Lesson[] = [...lessons];
    for (const day of days) {
      const key = dateKey(day);
      const weekday = (day.getDay() + 6) % 7;
      for (const slot of weeklyTemplate) {
        if (slot.weekday !== weekday) continue;
        const exists = next.some(
          (l) => l.date === key && l.time === slot.time && l.studentId === slot.studentId && l.groupId === slot.groupId
        );
        if (exists) continue;
        next.push({
          id: uid(),
          studentId: slot.studentId,
          groupId: slot.groupId,
          title: slot.title,
          date: key,
          time: slot.time,
          duration: slot.duration,
          price: slot.price,
          status: "scheduled",
          paymentStatus: "pending",
        });
        created++;
      }
    }
    setLessons(next);
    setShowTemplate(false);
    showToast(created > 0 ? `Добавлено занятий по шаблону: ${created}` : "По шаблону нечего добавлять — всё уже в расписании");
  }

  const weekDays = mode === "week" ? getWeekDays(cursor) : [];
  const weekLabel =
    mode === "week" && weekDays.length
      ? `${weekDays[0].getDate()} ${MONTHS_RU[weekDays[0].getMonth()].toLowerCase()} – ${weekDays[6].getDate()} ${MONTHS_RU[weekDays[6].getMonth()].toLowerCase()}`
      : "";
  const dayLabel = `${cursor.getDate()} ${MONTHS_RU[cursor.getMonth()].toLowerCase()} ${cursor.getFullYear()}, ${WEEKDAYS_RU[(cursor.getDay() + 6) % 7]}`;
  const dayLessonCount = mode === "day" ? displayedLessons.filter((l) => l.date === dateKey(cursor) && l.status !== "cancelled").length : 0;
  const highlightDates = useMemo(() => new Set(displayedLessons.map((l) => l.date)), [displayedLessons]);
  const cancelRequests = lessons.filter((l) => l.cancelRequested);
  const missingRecordLessons = lessons
    .filter((l) => l.studentId && l.status !== "cancelled" && isLessonPast(l) && !l.comment && (!l.attachments || l.attachments.length === 0))
    .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));

  return (
    <div>
      <PageHeader
        title="Расписание"
        right={
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex rounded-xl border border-gray-300 bg-white p-0.5 text-sm shadow-sm">
              <button
                onClick={() => setMode("month")}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${mode === "month" ? "bg-[#2563EB] text-white" : "text-gray-600 hover:bg-gray-50"}`}
              >
                Месяц
              </button>
              <button
                onClick={() => setMode("week")}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${mode === "week" ? "bg-[#2563EB] text-white" : "text-gray-600 hover:bg-gray-50"}`}
              >
                Неделя
              </button>
              <button
                onClick={() => setMode("day")}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${mode === "day" ? "bg-[#2563EB] text-white" : "text-gray-600 hover:bg-gray-50"}`}
              >
                День
              </button>
            </div>
            <button onClick={() => setCursor(TODAY)} className="px-3.5 py-2 rounded-xl bg-white border border-gray-300 shadow-sm text-sm font-medium hover:bg-gray-50 hover:border-gray-400 transition">
              Сегодня
            </button>
            {students.length > 0 && (
              <select
                value={studentFilter}
                onChange={(e) => setStudentFilter(e.target.value)}
                className="px-3.5 py-2 rounded-xl bg-white border border-gray-300 shadow-sm text-sm font-medium hover:border-gray-400 transition"
              >
                <option value="">Все ученики</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
            <div className="flex items-center bg-white border border-gray-300 shadow-sm rounded-xl">
              <button onClick={goPrev} className="p-2 hover:bg-gray-50 rounded-l-xl">
                <ChevronLeft size={16} />
              </button>
              <button onClick={goNext} className="p-2 hover:bg-gray-50 rounded-r-xl">
                <ChevronRight size={16} />
              </button>
            </div>
            {mode === "week" && (
              <button
                onClick={() => setShowTemplate(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-gray-300 shadow-sm text-sm font-medium hover:bg-gray-50 hover:border-gray-400 transition"
              >
                <CalendarClock size={15} /> Шаблон недели
              </button>
            )}
            {gcal.enabled &&
              (gcal.connected ? (
                <div className="inline-flex items-center gap-1.5 pl-3.5 pr-2 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-medium">
                  <CalendarCheck2 size={15} /> Google Calendar
                  <button onClick={gcal.disconnect} className="p-0.5 rounded-full hover:bg-emerald-100 text-emerald-600" title="Отключить">
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={gcal.connect}
                  disabled={gcal.connecting}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-gray-300 shadow-sm text-sm font-medium hover:bg-gray-50 hover:border-gray-400 transition disabled:opacity-50"
                >
                  <CalendarPlus size={15} /> {gcal.connecting ? "Подключение..." : "Подключить Google Calendar"}
                </button>
              ))}
            <PrimaryButton icon={Plus} onClick={() => openAdd(TODAY)}>
              Добавить занятие
            </PrimaryButton>
          </div>
        }
      />
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="text-xl font-bold">{mode === "month" ? `${MONTHS_RU[month]} ${year}` : mode === "week" ? weekLabel : dayLabel}</div>
        {mode === "day" && (
          <span className="text-sm font-medium text-gray-500">
            · {dayLessonCount} {pluralRu(dayLessonCount, ["занятие", "занятия", "занятий"])}
          </span>
        )}
      </div>

      {cancelRequests.length > 0 && (
        <Card className="mb-4 divide-y divide-amber-100 border-amber-200 bg-amber-50/40">
          <div className="px-4 sm:px-5 py-3 flex items-center gap-2 text-amber-700 text-sm font-semibold">
            <AlertTriangle size={16} /> Запросы на отмену занятий
          </div>
          {cancelRequests.map((l) => {
            const st = students.find((s) => s.id === l.studentId);
            return (
              <div key={l.id} className="flex items-center gap-3 px-4 sm:px-5 py-3 flex-wrap">
                {st ? <Avatar id={st.id} name={st.name} size={34} color={st.color} /> : <div className="w-[34px]" />}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{lessonLabel(l, students)}</div>
                  <div className="text-xs text-gray-500">
                    {fmtDateRu(l.date)} · {l.time}
                  </div>
                </div>
                <button
                  onClick={() => declineCancelRequest(l.id)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 transition"
                >
                  Отклонить
                </button>
                <button
                  onClick={() => approveCancelRequest(l.id)}
                  className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition"
                >
                  <Check size={13} /> Принять
                </button>
              </div>
            );
          })}
        </Card>
      )}

      {missingRecordLessons.length > 0 && (
        <Card className="mb-4 divide-y divide-amber-100 border-amber-200 bg-amber-50/40">
          <div className="px-4 sm:px-5 py-3 flex items-center gap-2 text-amber-700 text-sm font-semibold">
            <AlertTriangle size={16} /> Нет записи или комментария после урока
          </div>
          {missingRecordLessons.map((l) => {
            const st = students.find((s) => s.id === l.studentId);
            return (
              <div
                key={l.id}
                onClick={() => setEditLesson(l)}
                className="flex items-center gap-3 px-4 sm:px-5 py-3 cursor-pointer hover:bg-amber-50 transition"
              >
                {st ? <Avatar id={st.id} name={st.name} size={34} color={st.color} /> : <div className="w-[34px]" />}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{lessonLabel(l, students)}</div>
                  <div className="text-xs text-gray-500">
                    {fmtDateRu(l.date)} · {l.time}
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-100 text-amber-700 shrink-0">Заполнить</span>
              </div>
            );
          })}
        </Card>
      )}

      {students.length === 0 && groups.length === 0 && (
        <div className="mb-4 text-sm bg-amber-50 text-amber-700 px-4 py-2.5 rounded-xl">Добавьте учеников, чтобы планировать занятия</div>
      )}

      {gcal.error && <div className="mb-4 text-sm bg-red-50 text-red-600 px-4 py-2.5 rounded-xl">{gcal.error}</div>}

      <div className="flex items-start gap-4">
      <div className="flex-1 min-w-0">
      {mode === "month" ? (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-7 border-b border-[#E7E9EE] bg-[#FAFBFC]">
            {WEEKDAYS_RU.map((d) => (
              <div key={d} className="text-center text-xs font-semibold text-gray-500 py-3">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((c, i) => {
              const items = itemsOn(c.date);
              return (
                <div
                  key={i}
                  onClick={() => openAdd(c.date)}
                  className={`min-h-[92px] sm:min-h-[110px] border-b border-r border-[#F0F1F4] p-2 cursor-pointer hover:bg-[#FAFBFC] transition ${!c.current ? "bg-[#FCFCFD] text-gray-300" : ""}`}
                >
                  <div className={`text-sm w-6 h-6 flex items-center justify-center rounded-full ${isToday(c.date) ? "bg-[#2563EB] text-white font-semibold" : c.current ? "text-gray-800" : "text-gray-300"}`}>
                    {c.day}
                  </div>
                  <div className="mt-1 space-y-1">
                    {items.slice(0, 2).map((item) =>
                      item.kind === "gcal" ? (
                        <a
                          key={`g-${item.e.id}`}
                          href={item.e.htmlLink}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="block text-left text-[11px] px-1.5 py-0.5 rounded-md truncate font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition"
                        >
                          {item.e.allDay ? "Весь день" : item.e.time} · {item.e.title}
                        </a>
                      ) : (
                        <button
                          key={item.l.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditLesson(item.l);
                          }}
                          style={lessonAppearance(item.l).style}
                          className={`w-full text-left text-[11px] px-1.5 py-0.5 rounded-md truncate font-medium transition ${lessonAppearance(item.l).className}`}
                        >
                          {item.l.time} · {lessonLabel(item.l, students)}
                        </button>
                      )
                    )}
                    {items.length > 2 && <div className="text-[11px] text-gray-400">+{items.length - 2} ещё</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : mode === "week" ? (
        <Card className="overflow-hidden">
          <WeekView
            cursor={cursor}
            lessons={displayedLessons}
            students={students}
            gcalEvents={gcal.events}
            onDayClick={openAdd}
            onLessonClick={setEditLesson}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <WeekView
            cursor={cursor}
            days={[cursor]}
            lessons={displayedLessons}
            students={students}
            gcalEvents={gcal.events}
            onDayClick={openAdd}
            onLessonClick={setEditLesson}
          />
        </Card>
      )}
      </div>

      <div className="hidden lg:block w-72 shrink-0">
        <MiniCalendar selected={cursor} highlightDates={highlightDates} onSelect={setCursor} />
      </div>
      </div>

      <StudentBalances students={students} setStudents={setStudents} lessons={lessons} />

      {showAdd && <AddLessonModal date={addDate} students={students} groups={groups} onClose={() => setShowAdd(false)} onSave={addLesson} />}

      {editLesson &&
        (() => {
          const { prev, next } = adjacentLessons(lessons, editLesson);
          return (
            <LessonFormModal
              key={editLesson.id}
              studentName={students.find((s) => s.id === editLesson.studentId)?.name || editLesson.title}
              studentGrade={students.find((s) => s.id === editLesson.studentId)?.grade}
              defaultRate={editLesson.price}
              defaultDuration={editLesson.duration}
              lesson={editLesson}
              homework={homework}
              notes={notes}
              onAssignHomework={handleAssignHomework}
              onUpdateHomework={handleUpdateHomework}
              onClose={() => setEditLesson(null)}
              onSave={saveLessonEdit}
              onCancelLesson={() => cancelLessonEdit(editLesson.id)}
              onMoveLesson={(date, time) => moveLesson(editLesson.id, date, time)}
              onPrevLesson={prev ? () => setEditLesson(prev) : undefined}
              onNextLesson={next ? () => setEditLesson(next) : undefined}
            />
          );
        })()}

      {showTemplate && (
        <WeeklyTemplateModal
          slots={weeklyTemplate}
          setSlots={setWeeklyTemplate}
          students={students}
          groups={groups}
          onClose={() => setShowTemplate(false)}
          onApply={applyWeeklyTemplate}
        />
      )}
    </div>
  );
}

function AddLessonModal({
  date,
  students,
  groups,
  onClose,
  onSave,
}: {
  date: Date | null;
  students: Student[];
  groups: Group[];
  onClose: () => void;
  onSave: (data: Partial<Lesson> & { occurrences?: string[] }) => void;
}) {
  const options = [
    ...students.map((s) => ({ id: s.id, name: s.name, type: "student" as const, rate: s.rate || 0, duration: s.duration || 60 })),
    ...groups.map((g) => ({ id: g.id, name: g.name, type: "group" as const, rate: 0, duration: 60 })),
  ];
  const [who, setWho] = useState(options[0]?.id || "");
  const [time, setTime] = useState("15:00");
  const [duration, setDuration] = useState(options[0]?.duration || 60);
  const [price, setPrice] = useState(options[0]?.rate || 0);
  const [dateStr, setDateStr] = useState(dateKey(date || new Date()));
  const [recurring, setRecurring] = useState(false);
  const [freq, setFreq] = useState<RecurrenceFreq>("weekly");
  const [days, setDays] = useState<number[]>([]);
  const [endType, setEndType] = useState<RecurrenceEnd>("count");
  const [count, setCount] = useState(8);
  const [untilDate, setUntilDate] = useState("");

  function toggleDay(d: number) {
    setDays((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d]));
  }

  function selectWho(id: string) {
    setWho(id);
    const opt = options.find((o) => o.id === id);
    if (opt) {
      setDuration(opt.duration);
      setPrice(opt.rate);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const target = options.find((o) => o.id === who);
    if (!target) return;
    onSave({
      studentId: target.type === "student" ? target.id : undefined,
      groupId: target.type === "group" ? target.id : undefined,
      title: target.name,
      date: dateStr,
      time,
      duration: Number(duration),
      price: Number(price),
      occurrences: recurring ? buildRecurringDates(dateStr, freq, days, endType, count, untilDate) : undefined,
    });
  }

  return (
    <Modal title="Новое занятие" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Дата">
          <TextInput icon={CalendarIcon} type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} />
        </Field>
        {options.length > 0 ? (
          <Field label="Ученик или группа">
            <select value={who} onChange={(e) => selectWho(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F8FA] border border-[#E7E9EE] text-sm">
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} {o.type === "group" ? "(группа)" : ""}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <div className="text-sm text-gray-400">Сначала добавьте ученика или группу</div>
        )}
        <Field label="Время">
          <TextInput icon={Clock} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
        <Field label="Длительность, мин">
          <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F8FA] border border-[#E7E9EE] text-sm">
            {[30, 45, 60, 90, 120].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Стоимость, ₽">
          <TextInput icon={Wallet} type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
        </Field>
        <RecurrenceFields
          recurring={recurring}
          setRecurring={setRecurring}
          freq={freq}
          setFreq={setFreq}
          days={days}
          toggleDay={toggleDay}
          endType={endType}
          setEndType={setEndType}
          count={count}
          setCount={setCount}
          untilDate={untilDate}
          setUntilDate={setUntilDate}
        />
        <PrimaryButton type="submit" full disabled={options.length === 0}>
          Добавить в расписание
        </PrimaryButton>
      </form>
    </Modal>
  );
}
