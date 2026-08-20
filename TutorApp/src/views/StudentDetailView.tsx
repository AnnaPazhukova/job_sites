import { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Cake,
  Calendar as CalendarIcon,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  KeyRound,
  Layers,
  Mail,
  MessageCircle,
  Plus,
  School,
  Star,
  Target,
  Trash2,
  User,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Card, DurationPicker, EmptyState, Field, GhostButton, MethodNotePicker, Modal, PrimaryButton, RecurrenceFields, TextArea, TextInput } from "../components/ui";
import { AttachmentsField } from "../components/Attachments";
import {
  adjacentLessons,
  buildHomeworkAssignment,
  buildRecurringDates,
  fmtDateRu,
  GRADES,
  isLessonPast,
  normalizeHomeworkStatus,
  SUBSCRIPTION_SIZES,
  TODAY_KEY,
  uid,
  type RecurrenceEnd,
  type RecurrenceFreq,
} from "../lib/utils";
import { createInvite, getExistingAccessLink, inviteLink, revokeAccessLink, studentPortalEnabled } from "../lib/studentAuth";
import { HomeworkEditModal } from "./HomeworkView";
import type { Attachment, Homework, HomeworkStatus, Lesson, MessagesByStudent, MethodNote, Student, ViewId } from "../lib/types";

const CALENDAR_COLORS = ["#2563EB", "#059669", "#DC2626", "#D97706", "#7C3AED", "#DB2777", "#0D9488", "#4F46E5", "#EA580C", "#4B5563"];

const HW_STATUS_META: Record<HomeworkStatus, { label: string; color: string }> = {
  assigned: { label: "Не сдано", color: "bg-gray-100 text-gray-500" },
  submitted: { label: "На проверке", color: "bg-amber-50 text-amber-600" },
  done: { label: "Проверено", color: "bg-emerald-50 text-emerald-600" },
};

interface Props {
  students: Student[];
  setStudents: (s: Student[]) => void;
  lessons: Lesson[];
  setLessons: (l: Lesson[]) => void;
  homework: Homework[];
  setHomework: (h: Homework[]) => void;
  messages: MessagesByStudent;
  setMessages: (m: MessagesByStudent) => void;
  notes: MethodNote[];
  selectedStudentId: string | null;
  setView: (v: ViewId) => void;
  showToast: (t: string) => void;
  /** Set when navigating in from elsewhere (e.g. a topic's homework tab in
   * Методика) to jump straight to a specific lesson's edit modal. */
  initialLessonId?: string | null;
  onConsumeInitialLesson?: () => void;
}

export function StudentDetailPage({
  students,
  setStudents,
  lessons,
  setLessons,
  homework,
  setHomework,
  messages,
  setMessages,
  notes,
  selectedStudentId,
  setView,
  showToast,
  initialLessonId,
  onConsumeInitialLesson,
}: Props) {
  const student = students.find((s) => s.id === selectedStudentId);
  const [showLessonForm, setShowLessonForm] = useState(false);
  const [editLesson, setEditLesson] = useState<Lesson | null>(null);

  useEffect(() => {
    if (!initialLessonId) return;
    const lesson = lessons.find((l) => l.id === initialLessonId);
    if (lesson) {
      setEditLesson(lesson);
      setShowLessonForm(true);
    }
    onConsumeInitialLesson?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLessonId]);
  const [invite, setInvite] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPackagePicker, setShowPackagePicker] = useState(false);
  const [editingHw, setEditingHw] = useState<Homework | null>(null);

  useEffect(() => {
    if (!studentPortalEnabled || !selectedStudentId) return;
    setInvite(null);
    getExistingAccessLink(selectedStudentId).then(setInvite);
  }, [selectedStudentId]);

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

  async function handleInvite() {
    setInviteBusy(true);
    setInviteError(null);
    setCopied(false);
    try {
      const code = await createInvite(student!.id);
      setInvite(code);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Не удалось создать приглашение");
    } finally {
      setInviteBusy(false);
    }
  }

  async function copyInviteLink() {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(inviteLink(invite));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setInviteError("Не удалось скопировать ссылку");
    }
  }

  async function handleRevoke() {
    if (!invite) return;
    setInviteBusy(true);
    try {
      await revokeAccessLink(invite);
      setInvite(null);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Не удалось отключить доступ");
    } finally {
      setInviteBusy(false);
    }
  }

  function startSubscription(total: number) {
    save({ subscription: { total, remaining: total, startDate: TODAY_KEY } });
    setShowPackagePicker(false);
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

  function deleteLesson(id: string) {
    setLessons(lessons.filter((l) => l.id !== id));
    showToast("Занятие удалено");
    setShowLessonForm(false);
    setEditLesson(null);
  }

  function moveLesson(id: string, date: string, time: string) {
    setLessons(lessons.map((l) => (l.id === id ? { ...l, date, time } : l)));
    showToast("Занятие перенесено");
    setShowLessonForm(false);
    setEditLesson(null);
  }

  function handleAssignHomework(title: string, noteId?: string, due?: string, attachments?: Attachment[]) {
    if (!editLesson || !editLesson.studentId) return;
    const st = students.find((s) => s.id === editLesson.studentId);
    const { homework: hw, message } = buildHomeworkAssignment({ ...editLesson, noteId }, st?.name || editLesson.title, title, lessons, { due, attachments });
    setHomework([...homework, hw]);
    setMessages({ ...messages, [editLesson.studentId]: [...(messages[editLesson.studentId] || []), message] });
    showToast("Домашнее задание задано");
  }

  function handleUpdateHomework(id: string, patch: Partial<Homework>) {
    setHomework(homework.map((h) => (h.id === id ? { ...h, ...patch } : h)));
    setEditingHw(null);
    showToast("Домашнее задание обновлено");
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
          <div className="flex items-center gap-2 flex-wrap">
            {studentPortalEnabled && !invite && (
              <GhostButton icon={KeyRound} onClick={handleInvite} disabled={inviteBusy}>
                {inviteBusy ? "Создаём…" : "Пригласить в кабинет"}
              </GhostButton>
            )}
            <PrimaryButton icon={MessageCircle} onClick={() => setView("messages")}>
              Написать
            </PrimaryButton>
          </div>
        </div>

        {(invite || inviteError) && (
          <div className="mb-5 rounded-xl border border-[#E7E9EE] bg-[#F7F8FA] px-4 py-3">
            {inviteError ? (
              <div className="text-sm text-red-600">{inviteError}</div>
            ) : (
              <>
                <div className="text-xs text-gray-500 mb-1.5">
                  Отправьте эту ссылку ученику — перейдя по ней, он сразу попадёт в свой личный кабинет (расписание, переписка, домашние задания), без регистрации и пароля. Ссылка постоянная — работает, пока вы её не отключите.
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <TextInput readOnly value={inviteLink(invite!)} className="text-xs" />
                  <button
                    onClick={copyInviteLink}
                    className="shrink-0 inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 transition"
                  >
                    <Copy size={14} /> {copied ? "Скопировано" : "Копировать"}
                  </button>
                  <button
                    onClick={handleRevoke}
                    disabled={inviteBusy}
                    className="shrink-0 inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2.5 rounded-xl border border-red-200 text-red-600 bg-white hover:bg-red-50 transition disabled:opacity-50"
                  >
                    <X size={14} /> Отключить доступ
                  </button>
                </div>
              </>
            )}
          </div>
        )}

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
            <Field label="Дата заведения">
              <TextInput icon={CalendarIcon} value={fmtDateRu(student.joinedAt)} readOnly />
            </Field>
            <Field label="Дата рождения">
              <TextInput icon={Cake} type="date" value={student.birthDate || ""} onChange={(e) => save({ birthDate: e.target.value })} />
            </Field>
            <Field label="E-mail">
              <TextInput icon={Mail} type="email" value={student.email || ""} onChange={(e) => save({ email: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Класс">
                <select
                  value={student.grade || ""}
                  onChange={(e) => save({ grade: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F8FA] border border-[#E7E9EE] text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
                >
                  <option value="">Не выбран</option>
                  {GRADES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
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
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">Абонемент</div>
              {student.subscription && !showPackagePicker ? (
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
                    <GhostButton full onClick={() => setShowPackagePicker(true)}>
                      Новый абонемент
                    </GhostButton>
                  </div>
                  <button
                    type="button"
                    onClick={() => save({ subscription: null })}
                    className="text-xs text-gray-400 hover:text-red-500 underline underline-offset-2"
                  >
                    Отключить абонемент
                  </button>
                </div>
              ) : (
                <div className="rounded-xl bg-[#F7F8FA] border border-[#E7E9EE] px-3.5 py-3 space-y-2">
                  <div className="text-xs text-gray-500">Сколько занятий в абонементе?</div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {SUBSCRIPTION_SIZES.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => startSubscription(n)}
                        className="py-2 rounded-lg text-sm font-medium border bg-white border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition"
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  {student.subscription && (
                    <button
                      type="button"
                      onClick={() => setShowPackagePicker(false)}
                      className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
                    >
                      Отмена
                    </button>
                  )}
                </div>
              )}
            </div>
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
            {studentLessons.map((l, i) => {
              const topic = l.noteId ? notes.find((n) => n.id === l.noteId)?.topic : null;
              const held = l.status !== "cancelled" && isLessonPast(l);
              return (
                <div key={l.id} className="px-4 sm:px-5 py-3.5 hover:bg-[#FAFBFC]">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
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
                      ${l.status === "cancelled" ? "bg-gray-100 text-gray-400" : held ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-[#2563EB]"}`}
                    >
                      <Clock size={13} /> {l.status === "cancelled" ? "Отменено" : held ? "Проведено" : "Запланировано"}
                    </span>
                    {l.status !== "cancelled" && (
                      <span
                        className={`text-xs font-medium px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 shrink-0
                        ${l.paymentStatus === "paid" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-500"}`}
                      >
                        <Wallet size={13} /> {l.paymentStatus === "paid" ? "Оплачено" : "Ожидает оплаты"}
                      </span>
                    )}
                    <button
                      onClick={() => (l.status === "cancelled" ? null : cancelLesson(l.id))}
                      disabled={l.status === "cancelled"}
                      className="w-full sm:w-auto sm:ml-auto bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2 rounded-xl transition shrink-0"
                    >
                      Отменить
                    </button>
                  </div>
                  {(topic || l.nextPlan) && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 pl-9 text-xs text-gray-500">
                      {topic && (
                        <span className="inline-flex items-center gap-1">
                          <Layers size={12} className="text-gray-400 shrink-0" /> {topic}
                        </span>
                      )}
                      {l.nextPlan && (
                        <span className="inline-flex items-center gap-1 min-w-0">
                          <ArrowRight size={12} className="text-gray-400 shrink-0" />
                          <span className="truncate">План: {l.nextPlan}</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {studentHomework.length > 0 && (
        <div className="mt-5">
          <div className="font-semibold text-lg mb-3">Домашние задания</div>
          <Card className="divide-y divide-[#F0F1F4]">
            {studentHomework.map((h) => (
              <div
                key={h.id}
                onClick={() => setEditingHw(h)}
                className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 cursor-pointer hover:bg-gray-50 transition"
              >
                <span className="text-sm">{h.title}</span>
                <span className={`text-xs font-semibold px-2 py-1 rounded-lg shrink-0 ${HW_STATUS_META[normalizeHomeworkStatus(h.status)].color}`}>
                  {HW_STATUS_META[normalizeHomeworkStatus(h.status)].label}
                </span>
              </div>
            ))}
          </Card>
        </div>
      )}

      {showLessonForm &&
        (() => {
          const { prev, next } = editLesson ? adjacentLessons(lessons, editLesson) : { prev: null, next: null };
          return (
            <LessonFormModal
              key={editLesson?.id || "new"}
              studentName={student.name}
              studentGrade={student.grade}
              defaultRate={student.rate || 0}
              defaultDuration={student.duration || 60}
              lesson={editLesson}
              homework={homework}
              notes={notes}
              onAssignHomework={handleAssignHomework}
              onUpdateHomework={handleUpdateHomework}
              onClose={() => {
                setShowLessonForm(false);
                setEditLesson(null);
              }}
              onSave={saveLesson}
              onCancelLesson={editLesson ? () => cancelLesson(editLesson.id) : null}
              onDeleteLesson={editLesson ? () => deleteLesson(editLesson.id) : undefined}
              onMoveLesson={editLesson ? (date, time) => moveLesson(editLesson.id, date, time) : undefined}
              onPrevLesson={prev ? () => setEditLesson(prev) : undefined}
              onNextLesson={next ? () => setEditLesson(next) : undefined}
            />
          );
        })()}

      {editingHw && <HomeworkEditModal homework={editingHw} onClose={() => setEditingHw(null)} onSave={handleUpdateHomework} />}
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
  studentGrade?: string;
  defaultRate: number;
  defaultDuration: number;
  lesson: Lesson | null;
  homework?: Homework[];
  notes?: MethodNote[];
  onAssignHomework?: (title: string, noteId?: string, due?: string, attachments?: Attachment[]) => void;
  onUpdateHomework?: (id: string, patch: Partial<Homework>) => void;
  onClose: () => void;
  onSave: (data: Partial<Lesson> & { occurrences?: string[] }) => void;
  onCancelLesson: (() => void) | null;
  /** Permanently removes this lesson (unlike onCancelLesson, which just marks it cancelled). */
  onDeleteLesson?: () => void;
  /** Reschedules just this lesson instance (by date+time) — never touches other lessons in a recurring series. */
  onMoveLesson?: (date: string, time: string) => void;
  /** Adjacent lessons for the same student — set to switch the modal to that lesson without closing it. */
  onPrevLesson?: () => void;
  onNextLesson?: () => void;
}

export function LessonFormModal({
  studentName,
  studentGrade,
  defaultRate,
  defaultDuration,
  lesson,
  homework = [],
  notes = [],
  onAssignHomework,
  onUpdateHomework,
  onClose,
  onSave,
  onCancelLesson,
  onDeleteLesson,
  onMoveLesson,
  onPrevLesson,
  onNextLesson,
}: LessonFormProps) {
  const isEdit = !!lesson;
  const [date, setDate] = useState(lesson?.date || TODAY_KEY);
  const [time, setTime] = useState(lesson?.time || "15:00");
  const [duration, setDuration] = useState(lesson?.duration || defaultDuration || 60);
  const [price, setPrice] = useState(lesson?.price ?? defaultRate ?? 0);
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "pending">(lesson?.paymentStatus || "pending");
  const [comment, setComment] = useState(lesson?.comment || "");
  const [nextPlan, setNextPlan] = useState(lesson?.nextPlan || "");
  const [lessonAttachments, setLessonAttachments] = useState<Attachment[]>(lesson?.attachments || []);
  const [noteId, setNoteId] = useState(lesson?.noteId || "");
  const [hwText, setHwText] = useState("");
  const [hwDue, setHwDue] = useState("");
  const [hwAttachments, setHwAttachments] = useState<Attachment[]>([]);
  const [editingHw, setEditingHw] = useState(false);
  const [hwEditText, setHwEditText] = useState("");
  const [hwEditDue, setHwEditDue] = useState("");
  const [hwEditAttachments, setHwEditAttachments] = useState<Attachment[]>([]);
  const [recurring, setRecurring] = useState(false);
  const [freq, setFreq] = useState<RecurrenceFreq>("weekly");
  const [days, setDays] = useState<number[]>([]);
  const [endType, setEndType] = useState<RecurrenceEnd>("count");
  const [count, setCount] = useState(8);
  const [untilDate, setUntilDate] = useState("");

  const isPast = isEdit && isLessonPast(lesson!);
  const isCancelled = lesson?.status === "cancelled";
  const linkedHomework = isEdit ? homework.find((h) => h.lessonId === lesson!.id) : null;
  const selectedNote = noteId ? notes.find((n) => n.id === noteId) : null;
  const noteHomeworkText = selectedNote?.tabs?.homework?.trim() || "";

  function toggleDay(d: number) {
    setDays((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d]));
  }

  function buildOccurrences(): string[] {
    if (!recurring) return [date];
    return buildRecurringDates(date, freq, days, endType, count, untilDate);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (isEdit) {
      onSave({
        id: lesson!.id,
        date,
        time,
        duration: Number(duration),
        price: Number(price),
        paymentStatus,
        comment,
        nextPlan: nextPlan || undefined,
        attachments: lessonAttachments,
        noteId: noteId || undefined,
      });
    } else {
      onSave({ date, time, duration: Number(duration), price: Number(price), occurrences: buildOccurrences() });
    }
  }

  function assignHomework() {
    if (!hwText.trim() || !onAssignHomework) return;
    if (isEdit && noteId !== (lesson?.noteId || "")) {
      onSave({ id: lesson!.id, noteId: noteId || undefined });
    }
    onAssignHomework(hwText.trim(), noteId || undefined, hwDue || undefined, hwAttachments);
    setHwText("");
    setHwDue("");
    setHwAttachments([]);
  }

  function useNoteHomework() {
    if (noteHomeworkText) setHwText(noteHomeworkText);
  }

  function startEditingHw() {
    if (!linkedHomework) return;
    setHwEditText(linkedHomework.title);
    setHwEditDue(linkedHomework.due || "");
    setHwEditAttachments(linkedHomework.attachments || []);
    setEditingHw(true);
  }

  function saveHwEdit() {
    if (!linkedHomework || !onUpdateHomework || !hwEditText.trim()) return;
    onUpdateHomework(linkedHomework.id, { title: hwEditText.trim(), due: hwEditDue || null, attachments: hwEditAttachments });
    setEditingHw(false);
  }

  return (
    <Modal
      title={isPast ? `Урок · ${fmtDateRu(lesson!.date)}` : isEdit ? "Занятие" : "Добавление занятия"}
      onClose={onClose}
      wide={!isPast}
      full={isPast}
      headerActions={
        isEdit && onDeleteLesson ? (
          <button
            onClick={() => window.confirm("Удалить это занятие насовсем? Это действие нельзя отменить.") && onDeleteLesson()}
            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition"
            title="Удалить занятие"
          >
            <Trash2 size={18} />
          </button>
        ) : undefined
      }
    >
      {isEdit && (
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          {isPast ? (
            <>
              {isCancelled && (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded-xl bg-gray-100 text-gray-400">
                  <Clock size={15} /> Отменено
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded-xl bg-gray-100 text-gray-600">
                <User size={15} /> {studentName}
              </span>
              <span className="inline-flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded-xl bg-gray-100 text-gray-600">
                <Clock size={15} /> {time} · {duration} мин · {price} ₽
              </span>
            </>
          ) : (
            <span
              className={`inline-flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded-xl ${
                isCancelled ? "bg-gray-100 text-gray-400" : "bg-blue-50 text-[#2563EB]"
              }`}
            >
              <Clock size={15} /> {isCancelled ? "Отменено" : "Запланировано"}
            </span>
          )}
          {/* A cancelled lesson isn't billed, so payment status doesn't apply — see studentBalance() in StudentsView. */}
          {!isCancelled && (
            <button
              type="button"
              onClick={() => setPaymentStatus((p) => (p === "paid" ? "pending" : "paid"))}
              className={`inline-flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded-xl border transition
                ${paymentStatus === "paid" ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-blue-50 border-blue-200 text-[#2563EB]"}`}
            >
              {paymentStatus === "paid" ? <Check size={15} /> : <Wallet size={15} />}
              {paymentStatus === "paid" ? "Оплачено" : "Отметить оплату"}
            </button>
          )}
        </div>
      )}

      {isEdit && (onPrevLesson || onNextLesson) && (
        <div className="flex items-center justify-between gap-2 mb-5 -mt-2">
          <button
            type="button"
            onClick={onPrevLesson}
            disabled={!onPrevLesson}
            className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft size={16} /> Предыдущий урок
          </button>
          <button
            type="button"
            onClick={onNextLesson}
            disabled={!onNextLesson}
            className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            Следующий урок <ChevronRight size={16} />
          </button>
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        {!isPast && (
          <>
            <Field label="Ученик">
              <TextInput icon={User} value={studentName} readOnly />
            </Field>

            <Field label="Дата">
              <TextInput icon={CalendarIcon} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Время">
              <TextInput icon={Clock} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
            {isEdit && onMoveLesson && (
              <button
                type="button"
                onClick={() => onMoveLesson(date, time)}
                className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-medium text-[#2563EB] bg-blue-50 hover:bg-blue-100 px-3.5 py-2.5 rounded-xl transition"
              >
                <CalendarClock size={15} /> Перенести урок на эти дату и время
              </button>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Длительность, мин">
                <TextInput type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
              </Field>
              <Field label="Стоимость, ₽">
                <TextInput icon={Wallet} type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
              </Field>
            </div>
          </>
        )}

        {isPast && (
          <>
            <Field label="Урок из методики">
              <MethodNotePicker notes={notes} value={noteId} onChange={setNoteId} defaultGrade={studentGrade} />
            </Field>

            <div className="grid sm:grid-cols-2 gap-5">
              <div className="space-y-4">
                <Field label="Комментарий об уроке">
                  <TextArea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={5}
                    placeholder="Как прошёл урок, что отработали, на что обратить внимание..."
                  />
                </Field>
                <Field label="План на следующий урок">
                  <TextArea
                    value={nextPlan}
                    onChange={(e) => setNextPlan(e.target.value)}
                    rows={3}
                    placeholder="Что разобрать в следующий раз..."
                  />
                </Field>
                <AttachmentsField attachments={lessonAttachments} onChange={setLessonAttachments} label="Запись урока (фото, PDF)" />
              </div>

              {lesson!.studentId && (
              <div>
                <div className="text-sm font-medium text-gray-700 mb-1.5">Домашнее задание</div>
                {linkedHomework ? (
                  editingHw ? (
                    <div className="space-y-2">
                      <TextArea value={hwEditText} onChange={(e) => setHwEditText(e.target.value)} rows={4} />
                      <Field label="Срок сдачи">
                        <TextInput type="date" value={hwEditDue} onChange={(e) => setHwEditDue(e.target.value)} />
                      </Field>
                      <AttachmentsField attachments={hwEditAttachments} onChange={setHwEditAttachments} label="Файлы к заданию" />
                      <div className="flex gap-2">
                        <GhostButton full onClick={() => setEditingHw(false)}>
                          Отмена
                        </GhostButton>
                        <PrimaryButton full onClick={saveHwEdit}>
                          Сохранить
                        </PrimaryButton>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={startEditingHw}
                      className="w-full text-left rounded-xl bg-[#F7F8FA] border border-[#E7E9EE] px-3.5 py-3 hover:border-gray-300 transition"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm flex items-center gap-1.5">
                          <BookOpen size={14} className="text-gray-400 shrink-0" /> {linkedHomework.title}
                        </span>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-lg shrink-0 ${HW_STATUS_META[normalizeHomeworkStatus(linkedHomework.status)].color}`}>
                          {HW_STATUS_META[normalizeHomeworkStatus(linkedHomework.status)].label}
                        </span>
                      </div>
                      {linkedHomework.due && <div className="text-xs text-gray-400 mt-1">Срок: {fmtDateRu(linkedHomework.due)}</div>}
                    </button>
                  )
                ) : (
                  <div className="space-y-2">
                    {noteHomeworkText && (
                      <button
                        type="button"
                        onClick={useNoteHomework}
                        className="w-full text-left rounded-xl bg-blue-50 border border-blue-100 px-3.5 py-2.5 text-sm text-[#2563EB] hover:bg-blue-100 transition"
                      >
                        <div className="font-medium text-xs uppercase tracking-wide mb-0.5">Д/З из методики «{selectedNote!.topic}»</div>
                        <div className="text-gray-700 line-clamp-2">{noteHomeworkText}</div>
                        <div className="text-[11px] text-[#2563EB] mt-1">Нажмите, чтобы использовать — текст можно будет изменить</div>
                      </button>
                    )}
                    <TextArea value={hwText} onChange={(e) => setHwText(e.target.value)} rows={5} placeholder="Что задать на дом..." />
                    <Field label="Срок сдачи">
                      <TextInput type="date" value={hwDue} onChange={(e) => setHwDue(e.target.value)} />
                    </Field>
                    <AttachmentsField attachments={hwAttachments} onChange={setHwAttachments} label="Файлы к заданию" />
                    <GhostButton icon={BookOpen} onClick={assignHomework} disabled={!hwText.trim()}>
                      Задать домашнее задание
                    </GhostButton>
                    <div className="text-xs text-gray-400">
                      Если не указать срок — по умолчанию до следующего занятия. Задание сразу появится в переписке с учеником.
                    </div>
                  </div>
                )}
              </div>
            )}
            </div>
          </>
        )}

        {!isEdit && (
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
        )}

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <div className="flex gap-2 order-2 sm:order-1">
            <GhostButton full onClick={onClose}>
              Закрыть
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
