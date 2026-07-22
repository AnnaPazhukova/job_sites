import { useState } from "react";
import {
  Cake,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  Clock,
  Mail,
  MessageCircle,
  Plus,
  School,
  Star,
  Target,
  User,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Card, DurationPicker, EmptyState, Field, GhostButton, Modal, PrimaryButton, Select, TextInput, ToggleRow } from "../components/ui";
import { dateKey, fmtDateRu, GRADES, TODAY_KEY, uid } from "../lib/utils";
import type { Homework, Lesson, Student, ViewId } from "../lib/types";

const CALENDAR_COLORS = ["#2563EB", "#059669", "#DC2626", "#D97706", "#7C3AED", "#DB2777", "#0D9488", "#4F46E5", "#EA580C", "#4B5563"];

interface Props {
  students: Student[];
  setStudents: (s: Student[]) => void;
  lessons: Lesson[];
  setLessons: (l: Lesson[]) => void;
  homework: Homework[];
  selectedStudentId: string | null;
  setView: (v: ViewId) => void;
  showToast: (t: string) => void;
}

export function StudentDetailPage({ students, setStudents, lessons, setLessons, homework, selectedStudentId, setView, showToast }: Props) {
  const student = students.find((s) => s.id === selectedStudentId);
  const [showLessonForm, setShowLessonForm] = useState(false);
  const [editLesson, setEditLesson] = useState<Lesson | null>(null);

  if (!student) {
    return (
      <div>
        <button onClick={() => setView("students")} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ChevronLeft size={16} /> Мои ученики
        </button>
        <EmptyState icon={Users} title="Ученик не найден" subtitle="Возможно, он был удалён" />
      </div>
    );
  }

  function save(patch: Partial<Student>) {
    setStudents(students.map((s) => (s.id === student!.id ? { ...s, ...patch } : s)));
  }

  function exclude() {
    setStudents(students.filter((s) => s.id !== student!.id));
    showToast("Ученик исключён из списка");
    setView("students");
  }

  const studentLessons = lessons
    .filter((l) => l.studentId === student.id)
    .sort((a, b) => b.date.localeCompare(a.date) || b.time?.localeCompare(a.time));
  const paidLessons = studentLessons.filter((l) => l.paymentStatus === "paid");
  const studentHomework = homework.filter((h) => h.studentId === student.id);
  const currentMonthPrefix = TODAY_KEY.slice(0, 7);
  const monthLessons = studentLessons.filter((l) => l.status !== "cancelled" && l.date.slice(0, 7) === currentMonthPrefix).length;
  const totalEarned = paidLessons.reduce((s, l) => s + (Number(l.price) || 0), 0);

  function saveLesson(data: Partial<Lesson> & { occurrences?: string[] }) {
    if (data.id) {
      setLessons(lessons.map((l) => (l.id === data.id ? { ...l, ...data } : l)));
      showToast("Занятие обновлено");
    } else {
      const { occurrences, ...base } = data;
      const dates = occurrences && occurrences.length ? occurrences : [base.date as string];
      const created: Lesson[] = dates.map((date) => ({
        ...(base as Omit<Lesson, "id" | "date" | "studentId" | "title" | "status" | "paymentStatus">),
        id: uid(),
        date,
        studentId: student!.id,
        title: student!.name,
        status: "scheduled",
        paymentStatus: "pending",
      }));
      setLessons([...lessons, ...created]);
      showToast(created.length > 1 ? `Добавлено занятий: ${created.length}` : "Занятие добавлено");
    }
    setShowLessonForm(false);
    setEditLesson(null);
  }

  function cancelLesson(id: string) {
    setLessons(lessons.map((l) => (l.id === id ? { ...l, status: "cancelled" } : l)));
    showToast("Занятие отменено");
    setShowLessonForm(false);
    setEditLesson(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView("students")}
            className="w-9 h-9 rounded-full border border-blue-200 text-[#2563EB] flex items-center justify-center hover:bg-blue-50 transition shrink-0"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
          <h1 className="text-2xl font-bold">{student.name}</h1>
          <button onClick={() => save({ favorite: !student.favorite })}>
            <Star size={22} className={student.favorite ? "fill-amber-400 text-amber-400" : "text-gray-300"} />
          </button>
        </div>
        <button onClick={exclude} className="border-2 border-red-500 text-red-600 font-semibold px-4 py-2 rounded-xl hover:bg-red-50 transition text-sm">
          Исключить из учеников
        </button>
      </div>

      <Card className="p-5 sm:p-6 mb-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <div className="font-bold text-xl">Основная информация</div>
          <PrimaryButton icon={MessageCircle} onClick={() => setView("messages")}>
            Написать
          </PrimaryButton>
        </div>

        <div className="grid lg:grid-cols-2 gap-x-8 gap-y-4">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Имя">
                <TextInput
                  icon={User}
                  value={student.firstName || ""}
                  onChange={(e) => save({ firstName: e.target.value, name: `${e.target.value} ${student.lastName || ""}`.trim() })}
                />
              </Field>
              <Field label="Фамилия">
                <TextInput
                  value={student.lastName || ""}
                  onChange={(e) => save({ lastName: e.target.value, name: `${student.firstName || ""} ${e.target.value}`.trim() })}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Дата заведения">
                <TextInput icon={CalendarIcon} value={fmtDateRu(student.joinedAt)} readOnly />
              </Field>
              <Field label="Дата рождения">
                <TextInput icon={Cake} type="date" value={student.birthDate || ""} onChange={(e) => save({ birthDate: e.target.value })} />
              </Field>
            </div>
            <Field label="E-mail">
              <TextInput icon={Mail} type="email" value={student.email || ""} onChange={(e) => save({ email: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Класс">
                <Select value={student.grade || GRADES[2]} onChange={(v) => save({ grade: v })} options={GRADES} />
              </Field>
              <Field label="Учебное заведение">
                <TextInput icon={School} value={student.school || ""} onChange={(e) => save({ school: e.target.value })} placeholder="Лицей №9" />
              </Field>
            </div>
            <Field label="Цель занятий">
              <TextInput icon={Target} value={student.goal || ""} onChange={(e) => save({ goal: e.target.value })} placeholder="Сдать ЕГЭ на 90+ баллов" />
            </Field>
          </div>

          <div className="space-y-4">
            <div className="font-bold text-xl mb-1">Оплата</div>
            <Field label="Стоимость, ₽">
              <TextInput icon={Wallet} type="number" value={student.rate || 0} onChange={(e) => save({ rate: Number(e.target.value) || 0 })} />
            </Field>
            <Field label="Время проведения урока">
              <DurationPicker value={student.duration || 60} onChange={(minutes) => save({ duration: minutes })} />
            </Field>
            <Field label="Заметка об ученике">
              <textarea
                value={student.note || ""}
                onChange={(e) => save({ note: e.target.value })}
                rows={3}
                placeholder="Например: цель занятий, особенности, договорённости..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F8FA] border border-[#E7E9EE] text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 resize-none"
              />
              <div className="text-xs text-gray-400 mt-1">Видна только вам.</div>
            </Field>
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">Цвет в календаре</div>
              <div className="flex items-center gap-2 flex-wrap">
                {CALENDAR_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => save({ color: c })}
                    style={{ background: c }}
                    className={`w-7 h-7 rounded-full transition ${student.color === c ? "ring-2 ring-offset-2 ring-gray-400" : ""}`}
                  />
                ))}
                <button
                  onClick={() => save({ color: null })}
                  className="w-7 h-7 rounded-full border-2 border-gray-300 flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:border-gray-400 transition"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
            <ToggleRow
              label="Абонемент"
              checked={!!student.subscription}
              onChange={(v) => save({ subscription: v ? { total: 8, remaining: 8, startDate: TODAY_KEY } : null })}
            />
            {student.subscription ? (
              <div className="rounded-xl bg-[#F7F8FA] border border-[#E7E9EE] px-3.5 py-3 space-y-2">
                <div className="text-xs text-gray-500">Абонемент от {fmtDateRu(student.subscription.startDate)}</div>
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>
                    {student.subscription.total - student.subscription.remaining} из {student.subscription.total} уроков использовано
                  </span>
                  <span className="text-[#2563EB]">{student.subscription.remaining} осталось</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className="h-full bg-[#2563EB]"
                    style={{ width: `${Math.min(100, (100 * (student.subscription.total - student.subscription.remaining)) / (student.subscription.total || 1))}%` }}
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <GhostButton
                    full
                    onClick={() => save({ subscription: { ...student.subscription!, remaining: Math.max(0, student.subscription!.remaining - 1) } })}
                  >
                    Списать занятие
                  </GhostButton>
                  <GhostButton full onClick={() => save({ subscription: { total: 8, remaining: 8, startDate: TODAY_KEY } })}>
                    Новый абонемент
                  </GhostButton>
                </div>
              </div>
            ) : (
              <div className="px-3.5 py-2.5 rounded-xl bg-[#F7F8FA] border border-[#E7E9EE] text-sm text-gray-400">Нет абонемента</div>
            )}
          </div>
        </div>

        <div className="font-bold text-xl mt-6 mb-4">Статистика</div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StudentStatBox color="blue" value={studentLessons.filter((l) => l.status !== "cancelled").length} label="всего занятий" />
          <StudentStatBox color="green" value={paidLessons.length} label="оплачено" />
          <StudentStatBox color="purple" value={monthLessons} label="в месяц" />
          <StudentStatBox color="orange" value={totalEarned} label="руб. всего" />
        </div>
      </Card>

      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold text-lg">Занятия</div>
        <PrimaryButton
          icon={Plus}
          onClick={() => {
            setEditLesson(null);
            setShowLessonForm(true);
          }}
        >
          Добавить занятие
        </PrimaryButton>
      </div>
      <Card>
        {studentLessons.length === 0 ? (
          <div className="py-14 text-center text-gray-400 text-sm">Занятий пока нет</div>
        ) : (
          <div className="divide-y divide-[#F0F1F4]">
            {studentLessons.map((l, i) => (
              <div key={l.id} className="flex flex-wrap items-center gap-2 sm:gap-3 px-4 sm:px-5 py-3.5 hover:bg-[#FAFBFC]">
                <span className="text-sm text-gray-400 w-6 shrink-0">{String(studentLessons.length - i).padStart(2, "0")}</span>
                <button
                  onClick={() => {
                    setEditLesson(l);
                    setShowLessonForm(true);
                  }}
                  className="text-sm font-medium shrink-0 text-left hover:text-[#2563EB]"
                >
                  {fmtDateRu(l.date)}
                </button>
                <span
                  className={`text-xs font-medium px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 shrink-0
                  ${l.status === "cancelled" ? "bg-gray-100 text-gray-400" : "bg-blue-50 text-[#2563EB]"}`}
                >
                  <Clock size={13} /> {l.status === "cancelled" ? "Отменено" : "Запланировано"}
                </span>
                <span
                  className={`text-xs font-medium px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 shrink-0
                  ${l.paymentStatus === "paid" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-500"}`}
                >
                  <Wallet size={13} /> {l.paymentStatus === "paid" ? "Оплачено" : "Ожидает оплаты"}
                </span>
                <button
                  onClick={() => (l.status === "cancelled" ? null : cancelLesson(l.id))}
                  disabled={l.status === "cancelled"}
                  className="w-full sm:w-auto sm:ml-auto bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2 rounded-xl transition shrink-0"
                >
                  Отменить
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {studentHomework.length > 0 && (
        <div className="mt-5">
          <div className="font-semibold text-lg mb-3">Домашние задания</div>
          <Card className="divide-y divide-[#F0F1F4]">
            {studentHomework.map((h) => (
              <div key={h.id} className="flex items-center justify-between px-4 sm:px-5 py-3">
                <span className="text-sm">{h.title}</span>
                <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${h.status === "done" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
                  {h.status === "done" ? "Проверено" : "На проверке"}
                </span>
              </div>
            ))}
          </Card>
        </div>
      )}

      {showLessonForm && (
        <LessonFormModal
          studentName={student.name}
          defaultRate={student.rate || 0}
          defaultDuration={student.duration || 60}
          lesson={editLesson}
          onClose={() => {
            setShowLessonForm(false);
            setEditLesson(null);
          }}
          onSave={saveLesson}
          onCancelLesson={editLesson ? () => cancelLesson(editLesson.id) : null}
        />
      )}
    </div>
  );
}

const STUDENT_STAT_STYLE: Record<string, { bg: string; text: string }> = {
  blue: { bg: "#EAF2FF", text: "#2563EB" },
  green: { bg: "#E9FBF1", text: "#059669" },
  purple: { bg: "#F3EEFF", text: "#7C3AED" },
  orange: { bg: "#FFF3E5", text: "#D97706" },
};

function StudentStatBox({ color, value, label }: { color: string; value: number; label: string }) {
  const style = STUDENT_STAT_STYLE[color];
  return (
    <div className="rounded-2xl py-6 text-center" style={{ background: style.bg }}>
      <div className="text-3xl font-extrabold" style={{ color: style.text }}>
        {value}
      </div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  );
}

interface LessonFormProps {
  studentName: string;
  defaultRate: number;
  defaultDuration: number;
  lesson: Lesson | null;
  onClose: () => void;
  onSave: (data: Partial<Lesson> & { occurrences?: string[] }) => void;
  onCancelLesson: (() => void) | null;
}

export function LessonFormModal({ studentName, defaultRate, defaultDuration, lesson, onClose, onSave, onCancelLesson }: LessonFormProps) {
  const isEdit = !!lesson;
  const [date, setDate] = useState(lesson?.date || TODAY_KEY);
  const [time, setTime] = useState(lesson?.time || "15:00");
  const [duration, setDuration] = useState(lesson?.duration || defaultDuration || 60);
  const [price, setPrice] = useState(lesson?.price ?? defaultRate ?? 0);
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "pending">(lesson?.paymentStatus || "pending");
  const [recurring, setRecurring] = useState(false);
  const [freq, setFreq] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [days, setDays] = useState<number[]>([]);
  const [endType, setEndType] = useState<"count" | "until" | "endless">("count");
  const [count, setCount] = useState(8);
  const [untilDate, setUntilDate] = useState("");

  function toggleDay(d: number) {
    setDays((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d]));
  }

  function buildOccurrences(): string[] {
    if (!recurring) return [date];
    const start = new Date(date + "T00:00:00");
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
      const wdSet = days.length ? days : [(start.getDay() + 6) % 7];
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

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (isEdit) {
      onSave({ id: lesson!.id, date, time, duration: Number(duration), price: Number(price), paymentStatus });
    } else {
      onSave({ date, time, duration: Number(duration), price: Number(price), occurrences: buildOccurrences() });
    }
  }

  const DAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  return (
    <Modal title={isEdit ? "Занятие" : "Добавление занятия"} onClose={onClose} wide>
      {isEdit && (
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded-xl bg-blue-50 text-[#2563EB]">
            <Clock size={15} /> Запланировано
          </span>
          <button
            type="button"
            onClick={() => setPaymentStatus((p) => (p === "paid" ? "pending" : "paid"))}
            className={`inline-flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded-xl border transition
              ${paymentStatus === "paid" ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-rose-50 border-rose-200 text-rose-600"}`}
          >
            {paymentStatus === "paid" ? <Check size={15} /> : <Wallet size={15} />}
            {paymentStatus === "paid" ? "Оплачено" : "Отметить оплату"}
          </button>
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        <Field label="Ученик">
          <TextInput icon={User} value={studentName} readOnly />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Дата">
            <TextInput icon={CalendarIcon} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Время">
            <TextInput icon={Clock} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Длительность, мин">
            <TextInput type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
          </Field>
          <Field label="Стоимость, ₽">
            <TextInput icon={Wallet} type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
          </Field>
        </div>

        {!isEdit && (
          <div className="border border-[#E7E9EE] rounded-xl p-4">
            <div className="flex items-center justify-between mb-1">
              <div>
                <div className="font-medium text-sm">Регулярные занятия</div>
                <div className="text-xs text-gray-500">Создать серию по расписанию</div>
              </div>
              <button
                type="button"
                onClick={() => setRecurring((r) => !r)}
                className={`w-10 h-6 rounded-full transition relative shrink-0 ${recurring ? "bg-[#2563EB]" : "bg-gray-200"}`}
              >
                <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full transition" style={{ left: recurring ? 18 : 2 }} />
              </button>
            </div>

            {recurring && (
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ["daily", "Ежедневно"],
                      ["weekly", "Еженедельно"],
                      ["monthly", "Ежемесячно"],
                    ] as const
                  ).map(([v, l]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setFreq(v)}
                      className={`py-2 rounded-xl text-sm font-medium border transition ${freq === v ? "bg-[#2563EB] text-white border-[#2563EB]" : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400"}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>

                {freq === "weekly" && (
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-2">Дни повторения</div>
                    <div className="grid grid-cols-7 gap-1.5">
                      {DAY_LABELS.map((l, i) => (
                        <button
                          key={l}
                          type="button"
                          onClick={() => toggleDay(i)}
                          className={`py-2 rounded-xl text-xs font-medium border transition ${days.includes(i) ? "bg-[#2563EB] text-white border-[#2563EB]" : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400"}`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">Окончание серии</div>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        ["count", "Количество"],
                        ["until", "До даты"],
                        ["endless", "Бессрочно"],
                      ] as const
                    ).map(([v, l]) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setEndType(v)}
                        className={`py-2 rounded-xl text-sm font-medium border transition ${endType === v ? "bg-[#2563EB] text-white border-[#2563EB]" : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400"}`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                {endType === "count" && (
                  <Field label="Количество занятий">
                    <TextInput type="number" value={count} onChange={(e) => setCount(Number(e.target.value) || 1)} />
                  </Field>
                )}
                {endType === "until" && (
                  <Field label="Дата окончания">
                    <TextInput type="date" value={untilDate} onChange={(e) => setUntilDate(e.target.value)} />
                  </Field>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <div className="flex gap-2 order-2 sm:order-1">
            <GhostButton full onClick={onClose}>
              Отмена
            </GhostButton>
            {isEdit && onCancelLesson && (
              <GhostButton full danger onClick={onCancelLesson}>
                Отменить занятие
              </GhostButton>
            )}
          </div>
          <button
            type="submit"
            className="order-1 sm:order-2 flex-1 inline-flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold px-4 py-2.5 rounded-xl transition text-sm"
          >
            {isEdit ? "Сохранить" : "Добавить"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
