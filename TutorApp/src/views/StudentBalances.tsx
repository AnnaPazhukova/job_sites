import { useState } from "react";
import { Plus } from "lucide-react";
import { Avatar, Card, Field, Modal, PrimaryButton, TextInput } from "../components/ui";
import { fmtDateRu, fmtMoney, TODAY_KEY } from "../lib/utils";
import { studentBalance } from "./StudentsView";
import type { Lesson, Student } from "../lib/types";

interface Props {
  students: Student[];
  setStudents: (s: Student[]) => void;
  lessons: Lesson[];
}

export function StudentBalances({ students, setStudents, lessons }: Props) {
  const [filter, setFilter] = useState<"all" | "debt">("all");
  const [subModalFor, setSubModalFor] = useState<string | null>(null);

  if (students.length === 0) return null;

  const withBalance = students.map((s) => ({ student: s, balance: studentBalance(lessons, s.id) }));
  const filtered = filter === "debt" ? withBalance.filter((x) => x.balance < 0) : withBalance;

  function saveSubscription(studentId: string, total: number, startDate: string) {
    setStudents(students.map((s) => (s.id === studentId ? { ...s, subscription: { total, remaining: total, startDate } } : s)));
    setSubModalFor(null);
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="font-semibold text-lg">Балансы учеников</div>
        <div className="inline-flex rounded-xl border border-gray-300 bg-white p-0.5 text-sm">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${filter === "all" ? "bg-[#2563EB] text-white" : "text-gray-600 hover:bg-gray-50"}`}
          >
            Все
          </button>
          <button
            onClick={() => setFilter("debt")}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${filter === "debt" ? "bg-[#2563EB] text-white" : "text-gray-600 hover:bg-gray-50"}`}
          >
            Должники
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="py-10 text-center text-gray-400 text-sm">Должников нет</Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(({ student, balance }) => (
            <Card key={student.id} className="p-4">
              <div className="flex items-center gap-2.5 mb-3">
                <Avatar id={student.id} name={student.name} size={36} color={student.color} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{student.name}</div>
                </div>
                {balance < 0 && (
                  <span className="text-xs font-semibold px-2 py-1 rounded-lg bg-red-50 text-red-600 shrink-0">Долг: {fmtMoney(-balance)}</span>
                )}
              </div>
              <div className="text-xs font-medium text-gray-500 mb-1.5">Абонементы</div>
              {student.subscription ? (
                <div className="space-y-1.5">
                  <div className="text-xs text-gray-500">Абонемент от {fmtDateRu(student.subscription.startDate)}</div>
                  <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
                    <div
                      className="h-full bg-[#2563EB]"
                      style={{
                        width: `${Math.min(100, (100 * (student.subscription.total - student.subscription.remaining)) / (student.subscription.total || 1))}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>
                      {student.subscription.total - student.subscription.remaining} из {student.subscription.total} уроков использовано
                    </span>
                    <button onClick={() => setSubModalFor(student.id)} className="text-[#2563EB] hover:underline font-medium shrink-0">
                      Обновить
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-xs text-gray-400 mb-2">Нет активных</div>
                  <button
                    onClick={() => setSubModalFor(student.id)}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-gray-300 text-sm text-gray-500 hover:border-[#2563EB] hover:text-[#2563EB] transition"
                  >
                    <Plus size={14} /> Добавить абонемент
                  </button>
                </>
              )}
            </Card>
          ))}
        </div>
      )}

      {subModalFor && (
        <AddSubscriptionModal
          studentName={students.find((s) => s.id === subModalFor)?.name || ""}
          onClose={() => setSubModalFor(null)}
          onSave={(total, startDate) => saveSubscription(subModalFor, total, startDate)}
        />
      )}
    </div>
  );
}

function AddSubscriptionModal({
  studentName,
  onClose,
  onSave,
}: {
  studentName: string;
  onClose: () => void;
  onSave: (total: number, startDate: string) => void;
}) {
  const [total, setTotal] = useState(8);
  const [startDate, setStartDate] = useState(TODAY_KEY);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSave(Number(total) || 1, startDate);
  }

  return (
    <Modal title={`Абонемент: ${studentName}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Количество занятий">
          <TextInput type="number" min={1} value={total} onChange={(e) => setTotal(Number(e.target.value))} />
        </Field>
        <Field label="Дата начала">
          <TextInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <PrimaryButton type="submit" full>
          Добавить абонемент
        </PrimaryButton>
      </form>
    </Modal>
  );
}
