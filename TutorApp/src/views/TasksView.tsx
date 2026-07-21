import { useMemo, useState } from "react";
import { BookOpen, Check, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Card, EmptyState, Field, GhostButton, PageHeader, Pill, PrimaryButton, Select, TextArea, TextInput } from "../components/ui";
import { uid } from "../lib/utils";
import type { Task } from "../lib/types";

const LEVELS = ["Базовый", "Средний", "Продвинутый", "Олимпиадный"];
const TYPES = ["Тренировочная", "Диагностическая", "На ошибку", "Итоговая"];
const GRADES = ["5 класс", "6 класс", "7 класс", "8 класс", "9 класс", "10 класс", "11 класс"];
const ALL_SUBJECTS = ["Математика", "Алгебра", "Геометрия"];
const subjectsForGrade = (grade: string) => (grade === "5 класс" || grade === "6 класс" ? ["Математика"] : ["Алгебра", "Геометрия"]);

const emptyTask = (): Task => ({
  id: uid(),
  topic: "",
  subtopic: "",
  grade: GRADES[1],
  subject: "Математика",
  level: LEVELS[0],
  type: TYPES[0],
  text: "",
  solution: "",
  errors: "",
  comment: "",
  createdAt: Date.now(),
});

interface Props {
  tasks: Task[];
  saveTasks: (t: Task[]) => void;
  showToast: (t: string) => void;
}

export function TasksView({ tasks, saveTasks, showToast }: Props) {
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [gradeFilter, setGradeFilter] = useState("Все классы");
  const [subjectFilter, setSubjectFilter] = useState("Все предметы");
  const [topicFilter, setTopicFilter] = useState("Все темы");
  const [levelFilter, setLevelFilter] = useState("Все уровни");
  const [typeFilter, setTypeFilter] = useState("Все типы");

  const topics = useMemo(() => [...new Set(tasks.map((t) => t.topic).filter(Boolean))].sort(), [tasks]);

  const filtered = useMemo(() => {
    return tasks
      .filter((t) => {
        if (gradeFilter !== "Все классы" && t.grade !== gradeFilter) return false;
        if (subjectFilter !== "Все предметы" && t.subject !== subjectFilter) return false;
        if (topicFilter !== "Все темы" && t.topic !== topicFilter) return false;
        if (levelFilter !== "Все уровни" && t.level !== levelFilter) return false;
        if (typeFilter !== "Все типы" && t.type !== typeFilter) return false;
        if (query.trim()) {
          const q = query.toLowerCase();
          const hay = [t.topic, t.subtopic, t.text, t.solution, t.errors, t.comment].join(" ").toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [tasks, gradeFilter, subjectFilter, topicFilter, levelFilter, typeFilter, query]);

  const handleSave = (task: Task) => {
    const exists = tasks.some((t) => t.id === task.id);
    const next = exists ? tasks.map((t) => (t.id === task.id ? task : t)) : [...tasks, task];
    saveTasks(next);
    setEditing(null);
    setCreating(false);
    showToast(exists ? "Задача обновлена" : "Задача добавлена в базу");
  };

  const handleDelete = (id: string) => {
    saveTasks(tasks.filter((t) => t.id !== id));
    showToast("Задача удалена");
  };

  return (
    <div>
      <PageHeader
        title="База заданий"
        subtitle="Ваша личная коллекция задач по темам, классам и уровням сложности"
        right={
          <PrimaryButton
            icon={Plus}
            onClick={() => {
              setCreating(true);
              setEditing(null);
            }}
          >
            Новая задача
          </PrimaryButton>
        }
      />

      <Card className="p-4 mb-5">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <TextInput placeholder="Поиск по тексту задачи..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-10" />
          </div>
          <div className="w-36"><Select value={gradeFilter} onChange={setGradeFilter} options={["Все классы", ...GRADES]} /></div>
          <div className="w-40"><Select value={subjectFilter} onChange={setSubjectFilter} options={["Все предметы", ...ALL_SUBJECTS]} /></div>
          <div className="w-44"><Select value={topicFilter} onChange={setTopicFilter} options={["Все темы", ...topics]} /></div>
          <div className="w-40"><Select value={levelFilter} onChange={setLevelFilter} options={["Все уровни", ...LEVELS]} /></div>
          <div className="w-40"><Select value={typeFilter} onChange={setTypeFilter} options={["Все типы", ...TYPES]} /></div>
        </div>
      </Card>

      {creating && <TaskForm initial={emptyTask()} topics={topics} onSave={handleSave} onCancel={() => setCreating(false)} />}
      {editing && <TaskForm initial={editing} topics={topics} onSave={handleSave} onCancel={() => setEditing(null)} />}

      {filtered.length === 0 && !creating ? (
        <EmptyState
          icon={BookOpen}
          title={tasks.length === 0 ? "Пока нет ни одной задачи" : "Ничего не найдено"}
          subtitle={tasks.length === 0 ? "Добавьте первую задачу в базу" : "Попробуйте изменить фильтры или запрос поиска"}
          action={
            tasks.length === 0 ? (
              <PrimaryButton icon={Plus} onClick={() => setCreating(true)}>
                Добавить задачу
              </PrimaryButton>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              onEdit={(tk) => {
                setEditing(tk);
                setCreating(false);
              }}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
      {tasks.length > 0 && (
        <p className="text-xs text-gray-400 mt-4 text-center">
          Показано {filtered.length} из {tasks.length}
        </p>
      )}
    </div>
  );
}

function TaskForm({ initial, topics, onSave, onCancel }: { initial: Task; topics: string[]; onSave: (t: Task) => void; onCancel: () => void }) {
  const [task, setTask] = useState<Task>(initial);
  const set = (k: keyof Task) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setTask((t) => ({ ...t, [k]: e.target.value }));

  return (
    <Card className="p-5 mb-4">
      <div className="grid sm:grid-cols-2 gap-4 mb-1">
        <Field label="Тема">
          <TextInput list="topics-list" value={task.topic} onChange={set("topic")} placeholder="Уравнения" />
          <datalist id="topics-list">
            {topics.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </Field>
        <Field label="Подтема">
          <TextInput value={task.subtopic} onChange={set("subtopic")} placeholder="Дробно-рациональные" />
        </Field>
        <Field label="Класс">
          <Select
            value={task.grade}
            onChange={(v) => {
              const opts = subjectsForGrade(v);
              setTask((t) => ({ ...t, grade: v, subject: opts.includes(t.subject) ? t.subject : opts[0] }));
            }}
            options={GRADES}
          />
        </Field>
        <Field label="Предмет">
          <Select value={task.subject} onChange={(v) => setTask((t) => ({ ...t, subject: v }))} options={subjectsForGrade(task.grade)} />
        </Field>
        <Field label="Уровень">
          <Select value={task.level} onChange={(v) => setTask((t) => ({ ...t, level: v }))} options={LEVELS} />
        </Field>
        <Field label="Тип задачи">
          <Select value={task.type} onChange={(v) => setTask((t) => ({ ...t, type: v }))} options={TYPES} />
        </Field>
      </div>
      <div className="mt-4">
        <Field label="Условие задачи">
          <TextArea value={task.text} onChange={set("text")} placeholder="Решите уравнение..." className="min-h-[90px] font-mono text-[13px]" />
        </Field>
      </div>
      <Field label="Решение">
        <TextArea value={task.solution} onChange={set("solution")} placeholder="Ход решения..." className="min-h-[90px] font-mono text-[13px]" />
      </Field>
      <Field label="Типичные ошибки учеников">
        <TextArea value={task.errors} onChange={set("errors")} placeholder="Забывают ОДЗ, теряют корень..." className="min-h-[60px]" />
      </Field>
      <Field label="Комментарий: зачем эта задача">
        <TextArea value={task.comment} onChange={set("comment")} placeholder="Проверяет понимание..." className="min-h-[60px]" />
      </Field>
      <div className="flex gap-2 justify-end mt-3">
        <GhostButton onClick={onCancel}>Отмена</GhostButton>
        <PrimaryButton icon={Check} onClick={() => task.topic.trim() && task.text.trim() && onSave(task)} disabled={!task.topic.trim() || !task.text.trim()}>
          Сохранить
        </PrimaryButton>
      </div>
    </Card>
  );
}

function TaskCard({ task, onEdit, onDelete }: { task: Task; onEdit: (t: Task) => void; onDelete: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setOpen((o) => !o)}>
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            <span className="text-sm font-semibold">{task.topic}</span>
            {task.subtopic && <span className="text-xs text-gray-400">— {task.subtopic}</span>}
          </div>
          <div className="flex gap-1.5 mb-2 flex-wrap">
            {task.grade && <Pill>{task.grade}</Pill>}
            {task.subject && <Pill>{task.subject}</Pill>}
            <Pill tone="level">{task.level}</Pill>
            <Pill tone="type">{task.type}</Pill>
          </div>
          <p className="text-[13px] font-mono text-gray-600 leading-relaxed line-clamp-2">{task.text}</p>
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={() => onEdit(task)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-[#2563EB]">
            <Pencil size={15} />
          </button>
          <button onClick={() => onDelete(task.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      {open && (
        <div className="mt-3 pt-3 border-t border-[#F0F1F4] space-y-2.5">
          {task.solution && (
            <div>
              <div className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-1">Решение</div>
              <p className="text-[13px] font-mono text-gray-600 whitespace-pre-wrap leading-relaxed">{task.solution}</p>
            </div>
          )}
          {task.errors && (
            <div>
              <div className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-1">Типичные ошибки</div>
              <p className="text-[13px] text-rose-600 whitespace-pre-wrap leading-relaxed">{task.errors}</p>
            </div>
          )}
          {task.comment && (
            <div>
              <div className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-1">Комментарий</div>
              <p className="text-[13px] text-gray-600 whitespace-pre-wrap leading-relaxed">{task.comment}</p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
