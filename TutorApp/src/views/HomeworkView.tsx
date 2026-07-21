import { useState } from "react";
import { BookOpen, Check, Plus, Search } from "lucide-react";
import { Avatar, Card, EmptyState, Field, Modal, PageHeader, PrimaryButton, TextInput } from "../components/ui";
import { fmtDateRu, TODAY_KEY, uid } from "../lib/utils";
import type { Homework, HomeworkStatus, Student } from "../lib/types";

interface Props {
  homework: Homework[];
  setHomework: (h: Homework[]) => void;
  students: Student[];
  showToast: (t: string) => void;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: "На проверке", color: "bg-amber-50 text-amber-600" },
  done: { label: "Проверено", color: "bg-emerald-50 text-emerald-600" },
  overdue: { label: "Просрочено", color: "bg-red-50 text-red-600" },
};

function effectiveStatus(h: Homework) {
  if (h.status === "done") return "done";
  if (h.due && h.due < TODAY_KEY) return "overdue";
  return "pending";
}

export function HomeworkView({ homework, setHomework, students, showToast }: Props) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);

  const filtered = homework.filter((h) => {
    const matchQ = h.title.toLowerCase().includes(query.toLowerCase()) || h.studentName.toLowerCase().includes(query.toLowerCase());
    const matchS = statusFilter === "all" || effectiveStatus(h) === statusFilter;
    return matchQ && matchS;
  });

  function markDone(id: string) {
    setHomework(homework.map((h) => (h.id === id ? { ...h, status: "done" as HomeworkStatus } : h)));
    showToast("Работа отмечена как проверенная");
  }

  function addHomework(data: { studentId: string; studentName: string; title: string; due: string | null }) {
    setHomework([{ id: uid(), status: "pending", ...data }, ...homework]);
    setShowAdd(false);
    showToast("Домашнее задание добавлено");
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
              <option value="pending">На проверке</option>
              <option value="done">Проверено</option>
              <option value="overdue">Просрочено</option>
            </select>
            <PrimaryButton icon={Plus} onClick={() => setShowAdd(true)}>
              Задать ДЗ
            </PrimaryButton>
          </div>
        }
      />

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
        <Card className="divide-y divide-[#F0F1F4]">
          {filtered.map((h) => {
            const st = students.find((s) => s.id === h.studentId);
            const meta = STATUS_META[effectiveStatus(h)];
            return (
              <div key={h.id} className="flex items-center gap-3 px-4 sm:px-5 py-4">
                {st ? <Avatar id={st.id} name={st.name} size={38} /> : <div className="w-[38px]" />}
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{h.title}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {h.studentName} · {h.due ? `срок до ${fmtDateRu(h.due)}` : "без срока"}
                  </div>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg shrink-0 ${meta.color}`}>{meta.label}</span>
                {h.status !== "done" && (
                  <button onClick={() => markDone(h.id)} className="p-2 rounded-lg hover:bg-emerald-50 text-emerald-600 shrink-0">
                    <Check size={16} />
                  </button>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && <div className="py-10 text-center text-gray-400 text-sm">Ничего не найдено</div>}
        </Card>
      )}

      {showAdd && <AddHomeworkModal students={students} onClose={() => setShowAdd(false)} onSave={addHomework} />}
    </div>
  );
}

function AddHomeworkModal({
  students,
  onClose,
  onSave,
}: {
  students: Student[];
  onClose: () => void;
  onSave: (data: { studentId: string; studentName: string; title: string; due: string | null }) => void;
}) {
  const [studentId, setStudentId] = useState(students[0]?.id || "");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const st = students.find((s) => s.id === studentId);
    if (!title.trim() || !st) return;
    onSave({ studentId, studentName: st.name, title: title.trim(), due: due || null });
  }

  return (
    <Modal title="Новое домашнее задание" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Ученик">
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F8FA] border border-[#E7E9EE] text-sm">
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Задание">
          <TextInput required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например, Решить №12-18, стр. 34" />
        </Field>
        <Field label="Срок сдачи">
          <TextInput type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
        <PrimaryButton type="submit" full disabled={students.length === 0}>
          Задать ДЗ
        </PrimaryButton>
      </form>
    </Modal>
  );
}
