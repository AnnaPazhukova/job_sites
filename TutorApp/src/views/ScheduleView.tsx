import { useMemo, useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, Plus, Wallet } from "lucide-react";
import { Card, Field, Modal, PageHeader, PrimaryButton, TextInput } from "../components/ui";
import { dateKey, MONTHS_RU, TODAY, WEEKDAYS_RU, uid } from "../lib/utils";
import type { Group, Lesson, Student } from "../lib/types";
import { LessonFormModal } from "./StudentDetailView";

interface Props {
  lessons: Lesson[];
  setLessons: (l: Lesson[]) => void;
  students: Student[];
  groups: Group[];
  showToast: (t: string) => void;
}

export function ScheduleView({ lessons, setLessons, students, groups, showToast }: Props) {
  const [cursor, setCursor] = useState(TODAY);
  const [showAdd, setShowAdd] = useState(false);
  const [addDate, setAddDate] = useState<Date | null>(null);
  const [editLesson, setEditLesson] = useState<Lesson | null>(null);

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

  function lessonsOn(d: Date) {
    return lessons.filter((l) => l.date === dateKey(d));
  }

  function addLesson(data: Partial<Lesson>) {
    setLessons([...lessons, { id: uid(), status: "scheduled", paymentStatus: "pending", ...data } as Lesson]);
    setShowAdd(false);
    showToast("Занятие добавлено в расписание");
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

  return (
    <div>
      <PageHeader
        title="Расписание"
        right={
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setCursor(TODAY)} className="px-3.5 py-2 rounded-xl bg-white border border-gray-300 shadow-sm text-sm font-medium hover:bg-gray-50 hover:border-gray-400 transition">
              Сегодня
            </button>
            <div className="flex items-center bg-white border border-gray-300 shadow-sm rounded-xl">
              <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="p-2 hover:bg-gray-50 rounded-l-xl">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="p-2 hover:bg-gray-50 rounded-r-xl">
                <ChevronRight size={16} />
              </button>
            </div>
            <PrimaryButton
              icon={Plus}
              onClick={() => {
                setAddDate(TODAY);
                setShowAdd(true);
              }}
            >
              Добавить занятие
            </PrimaryButton>
          </div>
        }
      />
      <div className="text-xl font-bold mb-4">
        {MONTHS_RU[month]} {year}
      </div>

      {students.length === 0 && groups.length === 0 && (
        <div className="mb-4 text-sm bg-amber-50 text-amber-700 px-4 py-2.5 rounded-xl">Добавьте учеников, чтобы планировать занятия</div>
      )}

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
            const dayLessons = lessonsOn(c.date);
            return (
              <div
                key={i}
                onClick={() => {
                  setAddDate(c.date);
                  setShowAdd(true);
                }}
                className={`min-h-[92px] sm:min-h-[110px] border-b border-r border-[#F0F1F4] p-2 cursor-pointer hover:bg-[#FAFBFC] transition ${!c.current ? "bg-[#FCFCFD] text-gray-300" : ""}`}
              >
                <div className={`text-sm w-6 h-6 flex items-center justify-center rounded-full ${isToday(c.date) ? "bg-[#2563EB] text-white font-semibold" : c.current ? "text-gray-800" : "text-gray-300"}`}>
                  {c.day}
                </div>
                <div className="mt-1 space-y-1">
                  {dayLessons.slice(0, 2).map((l) => (
                    <button
                      key={l.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditLesson(l);
                      }}
                      className={`w-full text-left text-[11px] px-1.5 py-0.5 rounded-md truncate font-medium transition
                        ${l.status === "cancelled" ? "bg-gray-100 text-gray-400 line-through" : "bg-[#EEF2FF] text-[#2563EB] hover:bg-[#E0E9FF]"}`}
                    >
                      {l.time} · {l.title}
                    </button>
                  ))}
                  {dayLessons.length > 2 && <div className="text-[11px] text-gray-400">+{dayLessons.length - 2} ещё</div>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {showAdd && <AddLessonModal date={addDate} students={students} groups={groups} onClose={() => setShowAdd(false)} onSave={addLesson} />}

      {editLesson && (
        <LessonFormModal
          studentName={students.find((s) => s.id === editLesson.studentId)?.name || editLesson.title}
          defaultRate={editLesson.price}
          defaultDuration={editLesson.duration}
          lesson={editLesson}
          onClose={() => setEditLesson(null)}
          onSave={saveLessonEdit}
          onCancelLesson={() => cancelLessonEdit(editLesson.id)}
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
  onSave: (data: Partial<Lesson>) => void;
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
    });
  }

  return (
    <Modal title="Новое занятие" onClose={onClose}>
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
        <div className="grid grid-cols-2 gap-3">
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
        </div>
        <Field label="Стоимость, ₽">
          <TextInput icon={Wallet} type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
        </Field>
        <PrimaryButton type="submit" full disabled={options.length === 0}>
          Добавить в расписание
        </PrimaryButton>
      </form>
    </Modal>
  );
}
