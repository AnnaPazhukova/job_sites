import { useEffect, useState } from "react";
import { Check, Layers, Plus, Trash2, X } from "lucide-react";
import { Card, PageHeader, Pill, PrimaryButton, Select, TextArea, TextInput } from "../components/ui";
import { uid } from "../lib/utils";
import type { MethodNote, Task } from "../lib/types";

const GRADES = ["5 класс", "6 класс", "7 класс", "8 класс", "9 класс", "10 класс", "11 класс"];
const subjectsForGrade = (grade: string) => (grade === "5 класс" || grade === "6 класс" ? ["Математика"] : ["Алгебра", "Геометрия"]);

const emptyNote = (): MethodNote => ({
  id: uid(),
  topic: "",
  grade: GRADES[1],
  subject: "Математика",
  content: "",
  updatedAt: Date.now(),
});

interface Props {
  notes: MethodNote[];
  saveNotes: (n: MethodNote[]) => void;
  tasks: Task[];
  showToast: (t: string) => void;
}

export function NotesView({ notes, saveNotes, tasks, showToast }: Props) {
  const [activeId, setActiveId] = useState<string | null>(notes[0]?.id ?? null);
  const [creating, setCreating] = useState(false);
  const [newTopic, setNewTopic] = useState("");
  const active = notes.find((n) => n.id === activeId) || null;
  const [draft, setDraft] = useState(active?.content ?? "");

  useEffect(() => {
    setDraft(active?.content ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const relatedCount = active ? tasks.filter((t) => t.topic === active.topic).length : 0;

  const [newGrade, setNewGrade] = useState(GRADES[1]);
  const [newSubject, setNewSubject] = useState("Математика");

  const handleCreate = () => {
    if (!newTopic.trim()) return;
    const note = { ...emptyNote(), topic: newTopic.trim(), grade: newGrade, subject: newSubject };
    saveNotes([...notes, note]);
    setActiveId(note.id);
    setNewTopic("");
    setCreating(false);
    showToast("Тема методики создана");
  };

  const handleSaveDraft = () => {
    if (!active) return;
    saveNotes(notes.map((n) => (n.id === active.id ? { ...n, content: draft, updatedAt: Date.now() } : n)));
    showToast("Заметка сохранена");
  };

  const handleDelete = (id: string) => {
    const next = notes.filter((n) => n.id !== id);
    saveNotes(next);
    if (activeId === id) setActiveId(next[0]?.id ?? null);
  };

  return (
    <div>
      <PageHeader title="Методика" subtitle="Как вы объясняете темы: порядок подачи, приёмы, разбор типичных ошибок" />

      <div className="flex gap-4 flex-col md:flex-row">
        <div className="md:w-[260px] shrink-0">
          <PrimaryButton icon={Plus} full onClick={() => setCreating(true)}>
            Тема методики
          </PrimaryButton>
          {creating && (
            <Card className="mt-2 p-3 space-y-2">
              <TextInput
                autoFocus
                placeholder="Название темы"
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
              <div className="flex gap-1.5">
                <Select
                  value={newGrade}
                  onChange={(v) => {
                    const opts = subjectsForGrade(v);
                    setNewGrade(v);
                    if (!opts.includes(newSubject)) setNewSubject(opts[0]);
                  }}
                  options={GRADES}
                />
                <Select value={newSubject} onChange={setNewSubject} options={subjectsForGrade(newGrade)} />
              </div>
              <div className="flex gap-2">
                <button onClick={handleCreate} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1D4ED8]">
                  <Check size={14} /> Создать
                </button>
                <button onClick={() => setCreating(false)} className="px-3 rounded-lg text-gray-400 hover:bg-gray-100">
                  <X size={16} />
                </button>
              </div>
            </Card>
          )}

          <div className="mt-2 space-y-1 max-h-[60vh] overflow-y-auto pr-1">
            {GRADES.filter((g) => notes.some((n) => n.grade === g)).map((g) => (
              <div key={g}>
                <div className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold px-2 pt-3 pb-1">{g}</div>
                {notes
                  .filter((n) => n.grade === g)
                  .map((n) => (
                    <NoteRow key={n.id} note={n} active={n.id === activeId} onClick={() => setActiveId(n.id)} onDelete={() => handleDelete(n.id)} />
                  ))}
              </div>
            ))}
            {notes.filter((n) => !GRADES.includes(n.grade)).map((n) => (
              <NoteRow key={n.id} note={n} active={n.id === activeId} onClick={() => setActiveId(n.id)} onDelete={() => handleDelete(n.id)} />
            ))}
            {notes.length === 0 && !creating && <p className="text-xs text-gray-400 px-2 py-4">Нет тем. Начните с той, что объясняете чаще всего.</p>}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {active ? (
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-lg">{active.topic}</h3>
                  {active.grade && <Pill tone="level">{active.grade}</Pill>}
                  {active.subject && <Pill>{active.subject}</Pill>}
                </div>
                {relatedCount > 0 && <Pill tone="type">{relatedCount} задач в базе</Pill>}
              </div>
              <TextArea
                className="min-h-[360px] text-sm"
                placeholder={
                  "Как вы вводите тему, в каком порядке — понятия, приёмы, разбор ошибок, диагностика прогресса...\n\nНапример:\n1. Начинаю с...\n2. Даю аналогию...\n3. Первая проверка понимания через задачу...\n4. Типичный затык у учеников — ..."
                }
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={handleSaveDraft}
              />
              <div className="flex justify-end mt-3">
                <PrimaryButton icon={Check} onClick={handleSaveDraft}>
                  Сохранить
                </PrimaryButton>
              </div>
            </Card>
          ) : (
            <Card className="flex flex-col items-center justify-center text-center py-20 px-6">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4 text-gray-400">
                <Layers size={28} strokeWidth={1.6} />
              </div>
              <div className="text-gray-500 text-sm">Выберите тему слева или создайте новую.</div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function NoteRow({ note, active, onClick, onDelete }: { note: MethodNote; active: boolean; onClick: () => void; onDelete: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`group flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
        active ? "bg-[#EEF2FF] text-[#2563EB] font-medium" : "text-gray-600 hover:bg-gray-50"
      }`}
    >
      <span className="truncate">{note.topic}</span>
      <Trash2
        size={13}
        className="opacity-0 group-hover:opacity-60 hover:!opacity-100 shrink-0 ml-2"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      />
    </div>
  );
}
