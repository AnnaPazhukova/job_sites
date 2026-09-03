import { useState } from "react";
import { AlertTriangle, BookOpen, Calendar, Check, ChevronDown, Layers, MessageSquareText, Paperclip, Plus, Search } from "lucide-react";
import { Avatar, Card, EmptyState, Field, MethodNotePicker, Modal, PageHeader, PrimaryButton, TextInput } from "../components/ui";
import { AttachmentList, AttachmentsField } from "../components/Attachments";
import { fmtDateRu, isLessonPast, nextLessonDate, normalizeHomeworkStatus, sortHomeworkNewestFirst, TODAY_KEY, uid } from "../lib/utils";
import type { Attachment, Homework, HomeworkStatus, Lesson, MethodNote, Student } from "../lib/types";

interface Props {
  homework: Homework[];
  setHomework: (h: Homework[]) => void;
  students: Student[];
  lessons: Lesson[];
  notes: MethodNote[];
  onOpenNote: (id: string) => void;
  showToast: (t: string) => void;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  assigned: { label: "Не сдано", color: "bg-gray-100 text-gray-500" },
  submitted: { label: "На проверке", color: "bg-amber-50 text-amber-600" },
  done: { label: "Проверено", color: "bg-emerald-50 text-emerald-600" },
  overdue: { label: "Просрочено", color: "bg-red-50 text-red-600" },
};

function effectiveStatus(h: Homework) {
  const status = normalizeHomeworkStatus(h.status);
  if (status === "done") return "done";
  if (status === "assigned" && h.due && h.due < TODAY_KEY) return "overdue";
  return status;
}

export function HomeworkView({ homework, setHomework, students, lessons, notes, onOpenNote, showToast }: Props) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [editingHw, setEditingHw] = useState<Homework | null>(null);
  const [presetLesson, setPresetLesson] = useState<Lesson | null>(null);
  const [showDone, setShowDone] = useState(false);

  const missingHwLessons = lessons
    .filter((l) => l.studentId && l.status !== "cancelled" && isLessonPast(l) && !homework.some((h) => h.lessonId === l.id))
    .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));

  function updateHomework(id: string, patch: Partial<Homework>) {
    setHomework(homework.map((h) => (h.id === id ? { ...h, ...patch } : h)));
    setEditingHw(null);
    showToast("Домашнее задание обновлено");
  }

  const filtered = sortHomeworkNewestFirst(
    homework.filter((h) => {
      const matchQ = h.title.toLowerCase().includes(query.toLowerCase()) || h.studentName.toLowerCase().includes(query.toLowerCase());
      const matchS = statusFilter === "all" || effectiveStatus(h) === statusFilter;
      return matchQ && matchS;
    })
  );

  function markDone(id: string) {
    setHomework(homework.map((h) => (h.id === id ? { ...h, status: "done" as HomeworkStatus } : h)));
    showToast("Работа отмечена как проверенная");
  }

  function addHomework(data: {
    studentId: string;
    studentName: string;
    title: string;
    due: string | null;
    noteId?: string;
    lessonId?: string;
    attachments: Attachment[];
  }) {
    setHomework([{ id: uid(), status: "assigned", createdAt: Date.now(), ...data }, ...homework]);
    setShowAdd(false);
    showToast("Домашнее задание добавлено");
  }

  function renderRow(h: Homework) {
    const st = students.find((s) => s.id === h.studentId);
    const meta = STATUS_META[effectiveStatus(h)];
    const linkedNote = h.noteId ? notes.find((n) => n.id === h.noteId) : null;
    const linkedLesson = h.lessonId ? lessons.find((l) => l.id === h.lessonId) : null;
    return (
      <div
        key={h.id}
        onClick={() => setEditingHw(h)}
        className="flex items-center gap-3 px-4 sm:px-5 py-4 flex-wrap cursor-pointer hover:bg-gray-50 transition"
      >
        {st ? <Avatar id={st.id} name={st.name} size={38} color={st.color} /> : <div className="w-[38px]" />}
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm truncate">{h.title}</div>
          <div className="text-xs text-gray-500 truncate">
            {h.studentName} · {h.due ? `срок до ${fmtDateRu(h.due)}` : "без срока"}
          </div>
          {(linkedNote || linkedLesson || (h.attachments && h.attachments.length > 0)) && (
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {linkedNote && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenNote(linkedNote.id);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md bg-blue-50 text-[#2563EB] hover:bg-blue-100 transition"
                >
                  <Layers size={11} /> {linkedNote.topic}
                </button>
              )}
              {linkedLesson && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md bg-emerald-50 text-emerald-700">
                  <Calendar size={11} /> урок {fmtDateRu(linkedLesson.date)}
                </span>
              )}
              {h.attachments && h.attachments.length > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md bg-gray-100 text-gray-600">
                  <Paperclip size={11} /> {h.attachments.length}
                </span>
              )}
            </div>
          )}
          {h.reviewComment && (
            <div className="flex items-start gap-1 mt-1.5 text-xs text-gray-500">
              <MessageSquareText size={12} className="shrink-0 mt-0.5 text-gray-400" />
              <span className="truncate">{h.reviewComment}</span>
            </div>
          )}
        </div>
        {h.grade != null && (
          <span className="w-8 h-8 flex items-center justify-center rounded-full bg-[#EEF2FF] text-[#2563EB] text-sm font-bold shrink-0">
            {h.grade}
          </span>
        )}
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg shrink-0 ${meta.color}`}>{meta.label}</span>
        {normalizeHomeworkStatus(h.status) === "submitted" && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              markDone(h.id);
            }}
            title="Отметить проверенным"
            className="p-2 rounded-lg hover:bg-emerald-50 text-emerald-600 shrink-0"
          >
            <Check size={16} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Проверка ДЗ"
        right={
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск"
                className="pl-10 pr-3.5 py-2.5 rounded-xl bg-white border border-gray-300 shadow-sm text-sm w-40 sm:w-48 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
              />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2.5 rounded-xl bg-white border border-gray-300 shadow-sm text-sm">
              <option value="all">Все статусы</option>
              <option value="assigned">Не сдано</option>
              <option value="submitted">На проверке</option>
              <option value="done">Проверено</option>
              <option value="overdue">Просрочено</option>
            </select>
            <PrimaryButton icon={Plus} onClick={() => setShowAdd(true)}>
              Задать ДЗ
            </PrimaryButton>
          </div>
        }
      />

      {missingHwLessons.length > 0 && (
        <Card className="mb-4 divide-y divide-amber-100 border-amber-200 bg-amber-50/40">
          <div className="px-4 sm:px-5 py-3 flex items-center gap-2 text-amber-700 text-sm font-semibold">
            <AlertTriangle size={16} /> Д/З не назначено после занятия
          </div>
          {missingHwLessons.map((l) => {
            const st = students.find((s) => s.id === l.studentId);
            return (
              <div
                key={l.id}
                onClick={() => setPresetLesson(l)}
                className="flex items-center gap-3 px-4 sm:px-5 py-3 cursor-pointer hover:bg-amber-50 transition"
              >
                {st ? <Avatar id={st.id} name={st.name} size={34} color={st.color} /> : <div className="w-[34px]" />}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{st?.name || l.title}</div>
                  <div className="text-xs text-gray-500">Урок {fmtDateRu(l.date)}</div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-100 text-amber-700 shrink-0">Задать ДЗ</span>
              </div>
            );
          })}
        </Card>
      )}

      {homework.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Работ для проверки нет"
          subtitle="Здесь появятся домашние задания ваших учеников, ожидающие проверки"
          action={
            students.length > 0 ? (
              <PrimaryButton icon={Plus} onClick={() => setShowAdd(true)}>
                Задать ДЗ
              </PrimaryButton>
            ) : null
          }
        />
      ) : (
        (() => {
          // Already-reviewed work is rarely acted on again, so once the list mixes
          // statuses it's folded into a collapsed block — keeps the page from
          // growing forever with rows nobody needs to look at day to day.
          const activeItems = filtered.filter((h) => normalizeHomeworkStatus(h.status) !== "done");
          const doneItems = filtered.filter((h) => normalizeHomeworkStatus(h.status) === "done");
          const collapseDone = statusFilter !== "done" && activeItems.length > 0;
          return (
            <>
              {activeItems.length > 0 && <Card className="divide-y divide-[#F0F1F4]">{activeItems.map(renderRow)}</Card>}
              {filtered.length === 0 && <Card className="py-10 text-center text-gray-400 text-sm">Ничего не найдено</Card>}
              {doneItems.length > 0 &&
                (collapseDone ? (
                  <div className="mt-4">
                    <button
                      onClick={() => setShowDone((s) => !s)}
                      className="w-full flex items-center justify-between px-1 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition"
                    >
                      <span>Проверено ({doneItems.length})</span>
                      <ChevronDown size={16} className={`transition-transform ${showDone ? "rotate-180" : ""}`} />
                    </button>
                    {showDone && <Card className="divide-y divide-[#F0F1F4] mt-2">{doneItems.map(renderRow)}</Card>}
                  </div>
                ) : (
                  <Card className={`divide-y divide-[#F0F1F4] ${activeItems.length > 0 ? "mt-4" : ""}`}>{doneItems.map(renderRow)}</Card>
                ))}
            </>
          );
        })()
      )}

      {showAdd && <AddHomeworkModal students={students} lessons={lessons} notes={notes} onClose={() => setShowAdd(false)} onSave={addHomework} />}
      {presetLesson && (
        <AddHomeworkModal
          students={students}
          lessons={lessons}
          notes={notes}
          presetLesson={presetLesson}
          onClose={() => setPresetLesson(null)}
          onSave={(data) => {
            addHomework(data);
            setPresetLesson(null);
          }}
        />
      )}
      {editingHw && <HomeworkEditModal homework={editingHw} onClose={() => setEditingHw(null)} onSave={updateHomework} />}
    </div>
  );
}

const HW_STATUS_OPTIONS: { value: HomeworkStatus; label: string }[] = [
  { value: "assigned", label: "Не сдано" },
  { value: "submitted", label: "На проверке" },
  { value: "done", label: "Проверено" },
];

export function HomeworkEditModal({
  homework,
  onClose,
  onSave,
}: {
  homework: Homework;
  onClose: () => void;
  onSave: (id: string, patch: Partial<Homework>) => void;
}) {
  const [title, setTitle] = useState(homework.title);
  const [due, setDue] = useState(homework.due || "");
  const [status, setStatus] = useState<HomeworkStatus>(normalizeHomeworkStatus(homework.status));
  const [attachments, setAttachments] = useState<Attachment[]>(homework.attachments || []);
  const [submissionAttachments, setSubmissionAttachments] = useState<Attachment[]>(homework.submissionAttachments || []);
  const [reviewComment, setReviewComment] = useState(homework.reviewComment || "");
  const [grade, setGrade] = useState<number | undefined>(homework.grade);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSave(homework.id, {
      title: title.trim(),
      due: due || null,
      status,
      attachments,
      submissionAttachments,
      reviewComment: reviewComment.trim() || undefined,
      grade,
    });
  }

  return (
    <Modal title="Домашнее задание" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="text-sm text-gray-500">{homework.studentName}</div>
        {submissionAttachments.length > 0 && (
          <div className="px-3.5 py-3 rounded-xl bg-emerald-50 border border-emerald-100">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 mb-1.5">Ответ ученика</div>
            <AttachmentList
              attachments={submissionAttachments}
              onRemove={(id) => setSubmissionAttachments((prev) => prev.filter((a) => a.id !== id))}
            />
          </div>
        )}
        <Field label="Задание">
          <textarea
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            rows={4}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F8FA] border border-[#E7E9EE] text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] resize-none"
          />
        </Field>
        <Field label="Срок сдачи">
          <TextInput type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
        <Field label="Статус">
          <div className="grid grid-cols-3 gap-2">
            {HW_STATUS_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setStatus(o.value)}
                className={`py-2 rounded-xl text-sm font-medium border transition ${
                  status === o.value ? "bg-[#2563EB] text-white border-[#2563EB]" : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Оценка">
          <div className="grid grid-cols-4 gap-2">
            {[2, 3, 4, 5].map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGrade((cur) => (cur === g ? undefined : g))}
                className={`py-2 rounded-xl text-sm font-medium border transition ${
                  grade === g ? "bg-[#2563EB] text-white border-[#2563EB]" : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
          <div className="text-xs text-gray-400 mt-1">Необязательно. Увидит ученик в личном кабинете.</div>
        </Field>
        <Field label="Комментарий о выполнении">
          <textarea
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value)}
            rows={3}
            placeholder="Насколько хорошо справился, на что обратить внимание в следующий раз..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F8FA] border border-[#E7E9EE] text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] resize-none"
          />
          <div className="text-xs text-gray-400 mt-1">Увидит ученик в личном кабинете.</div>
        </Field>
        <AttachmentsField attachments={attachments} onChange={setAttachments} />
        <PrimaryButton type="submit" full>
          Сохранить
        </PrimaryButton>
      </form>
    </Modal>
  );
}

function AddHomeworkModal({
  students,
  lessons,
  notes,
  presetLesson,
  onClose,
  onSave,
}: {
  students: Student[];
  lessons: Lesson[];
  notes: MethodNote[];
  presetLesson?: Lesson | null;
  onClose: () => void;
  onSave: (data: {
    studentId: string;
    studentName: string;
    title: string;
    due: string | null;
    noteId?: string;
    lessonId?: string;
    attachments: Attachment[];
  }) => void;
}) {
  const [studentId, setStudentId] = useState(presetLesson?.studentId || students[0]?.id || "");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState(presetLesson ? nextLessonDate(lessons, presetLesson.studentId!, presetLesson.date, presetLesson.time) || "" : "");
  const [noteId, setNoteId] = useState(presetLesson?.noteId || "");
  const [lessonId, setLessonId] = useState(presetLesson?.id || "");
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const studentLessons = lessons
    .filter((l) => l.studentId === studentId && l.status !== "cancelled")
    .sort((a, b) => b.date.localeCompare(a.date) || b.time?.localeCompare(a.time));

  function selectLesson(id: string) {
    setLessonId(id);
    const l = lessons.find((x) => x.id === id);
    if (l) {
      setDue(nextLessonDate(lessons, studentId, l.date, l.time) || "");
      if (!noteId && l.noteId) setNoteId(l.noteId);
    }
  }

  const selectedNote = noteId ? notes.find((n) => n.id === noteId) : null;
  const noteHomeworkText = selectedNote?.tabs?.homework?.trim() || "";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const st = students.find((s) => s.id === studentId);
    if (!title.trim() || !st) return;
    onSave({
      studentId,
      studentName: st.name,
      title: title.trim(),
      due: due || null,
      noteId: noteId || undefined,
      lessonId: lessonId || undefined,
      attachments,
    });
  }

  return (
    <Modal title="Новое домашнее задание" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Ученик">
          <select
            value={studentId}
            onChange={(e) => {
              setStudentId(e.target.value);
              setLessonId("");
              setDue("");
            }}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F8FA] border border-[#E7E9EE] text-sm"
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Задание">
          {noteHomeworkText && (
            <button
              type="button"
              onClick={() => setTitle(noteHomeworkText)}
              className="w-full text-left rounded-xl bg-blue-50 border border-blue-100 px-3.5 py-2.5 text-sm text-[#2563EB] hover:bg-blue-100 transition mb-2"
            >
              <div className="font-medium text-xs uppercase tracking-wide mb-0.5">Д/З из методики «{selectedNote!.topic}»</div>
              <div className="text-gray-700 line-clamp-2">{noteHomeworkText}</div>
              <div className="text-[11px] text-[#2563EB] mt-1">Нажмите, чтобы использовать — текст можно будет изменить</div>
            </button>
          )}
          <textarea
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            rows={4}
            placeholder="Например, Решить №12-18, стр. 34"
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F8FA] border border-[#E7E9EE] text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] resize-none"
          />
        </Field>
        <Field label="Срок сдачи">
          <TextInput type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          <div className="text-xs text-gray-400 mt-1">
            Ставится автоматически по дате следующего занятия при выборе урока ниже — можно изменить вручную.
          </div>
        </Field>
        <Field label="Урок из расписания (необязательно)">
          <select value={lessonId} onChange={(e) => selectLesson(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F8FA] border border-[#E7E9EE] text-sm">
            <option value="">Без урока</option>
            {studentLessons.map((l) => (
              <option key={l.id} value={l.id}>
                {fmtDateRu(l.date)}, {l.time}
              </option>
            ))}
          </select>
          {studentLessons.length === 0 && <div className="text-xs text-gray-400 mt-1">У этого ученика пока нет занятий в расписании</div>}
        </Field>
        <Field label="Урок из методики (необязательно)">
          <MethodNotePicker
            key={studentId}
            notes={notes}
            value={noteId}
            onChange={setNoteId}
            defaultGrade={students.find((s) => s.id === studentId)?.grade}
          />
        </Field>
        <AttachmentsField attachments={attachments} onChange={setAttachments} />
        <PrimaryButton type="submit" full disabled={students.length === 0}>
          Задать ДЗ
        </PrimaryButton>
      </form>
    </Modal>
  );
}
