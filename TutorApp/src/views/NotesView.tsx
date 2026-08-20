import { useEffect, useMemo, useState } from "react";
import { Check, GripVertical, Layers, Plus, Search, Trash2, X } from "lucide-react";
import { Card, PageHeader, Pill, PrimaryButton, Select, TextArea, TextInput } from "../components/ui";
import { AttachmentsField } from "../components/Attachments";
import { GRADES, uid } from "../lib/utils";
import type { Attachment, MethodNote, MethodNoteAttachments, MethodNoteTabKey, MethodNoteTabs, Task } from "../lib/types";

const subjectsForGrade = (grade: string) => {
  if (grade === "5 класс" || grade === "6 класс") return ["Математика"];
  if (grade === "9 класс") return ["Алгебра", "Геометрия", "ОГЭ-Матем", "ОГЭ-Инфа"];
  return ["Алгебра", "Геометрия"];
};
const ALL_SUBJECTS = ["Математика", "Алгебра", "Геометрия", "ОГЭ-Матем", "ОГЭ-Инфа"];
// Legacy label for what's now "ОГЭ-Матем" — notes saved under the old name
// before this rename still carry it verbatim in stored data (subject is
// snapshotted on the note, not looked up live), so anywhere a subject is
// read for display/filtering it needs mapping through this first.
const LEGACY_SUBJECT_ALIASES: Record<string, string> = { "Подготовка к ОГЭ": "ОГЭ-Матем" };
function displaySubject(subject: string): string {
  return LEGACY_SUBJECT_ALIASES[subject] || subject;
}
const NOTE_GRADES = GRADES.filter((g) => g !== "10 класс" && g !== "11 класс");

const TAB_ORDER: MethodNoteTabKey[] = ["theory", "rules", "tasks", "test", "homework"];
const TAB_LABELS: Record<MethodNoteTabKey, string> = {
  theory: "Теория",
  rules: "Правила",
  tasks: "Задания",
  test: "Тест",
  homework: "Д/З",
};
const TAB_PLACEHOLDERS: Record<MethodNoteTabKey, string> = {
  theory: "Как вы вводите тему, в каком порядке — понятия, приёмы, аналогии...",
  rules: "Формулировки правил, формулы. Сюда же удобно прикреплять фото страниц учебника.",
  tasks: "Задания для отработки темы на занятии.",
  test: "Проверочная работа/тест по теме.",
  homework: "Что обычно задаёте на дом по этой теме.",
};

const EMPTY_TABS: MethodNoteTabs = { theory: "", rules: "", tasks: "", test: "", homework: "" };

function getTabs(note: MethodNote | null): MethodNoteTabs {
  if (!note) return EMPTY_TABS;
  if (note.tabs) return note.tabs;
  return { ...EMPTY_TABS, theory: note.content || "" };
}

const emptyNote = (): MethodNote => ({
  id: uid(),
  topic: "",
  grade: NOTE_GRADES[1],
  subject: "Математика",
  tabs: { ...EMPTY_TABS },
  updatedAt: Date.now(),
});

interface Props {
  notes: MethodNote[];
  saveNotes: (n: MethodNote[]) => void;
  tasks: Task[];
  showToast: (t: string) => void;
  activeId: string | null;
  setActiveId: (id: string | null) => void;
}

export function NotesView({ notes, saveNotes, tasks, showToast, activeId, setActiveId }: Props) {
  const [creating, setCreating] = useState(false);
  const [newTopic, setNewTopic] = useState("");
  const active = notes.find((n) => n.id === activeId) || null;

  const [activeTab, setActiveTab] = useState<MethodNoteTabKey>("theory");
  const [draftTabs, setDraftTabs] = useState<MethodNoteTabs>(getTabs(active));
  const [editingTopic, setEditingTopic] = useState(false);
  const [topicDraft, setTopicDraft] = useState("");

  useEffect(() => {
    setDraftTabs(getTabs(active));
    setActiveTab("theory");
    setEditingTopic(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const [gradeFilter, setGradeFilter] = useState("Все классы");
  const [subjectFilter, setSubjectFilter] = useState("Все предметы");
  const [query, setQuery] = useState("");

  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      if (gradeFilter !== "Все классы" && n.grade !== gradeFilter) return false;
      if (subjectFilter !== "Все предметы" && displaySubject(n.subject) !== subjectFilter) return false;
      if (query.trim() && !n.topic.toLowerCase().includes(query.trim().toLowerCase())) return false;
      return true;
    });
  }, [notes, gradeFilter, subjectFilter, query]);

  const relatedCount = active ? tasks.filter((t) => t.topic === active.topic).length : 0;

  const [newGrade, setNewGrade] = useState(NOTE_GRADES[1]);
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
    saveNotes(notes.map((n) => (n.id === active.id ? { ...n, tabs: draftTabs, updatedAt: Date.now() } : n)));
    showToast("Заметка сохранена");
  };

  const startEditTopic = () => {
    if (!active) return;
    setTopicDraft(active.topic);
    setEditingTopic(true);
  };

  const handleRenameTopic = () => {
    if (!active) return;
    const next = topicDraft.trim();
    setEditingTopic(false);
    if (!next || next === active.topic) return;
    saveNotes(notes.map((n) => (n.id === active.id ? { ...n, topic: next, updatedAt: Date.now() } : n)));
    showToast("Название темы обновлено");
  };

  const handleAttachmentsChange = (tabKey: MethodNoteTabKey, next: Attachment[]) => {
    if (!active) return;
    const nextAttachments: MethodNoteAttachments = { ...(active.attachments || {}), [tabKey]: next };
    saveNotes(notes.map((n) => (n.id === active.id ? { ...n, attachments: nextAttachments, updatedAt: Date.now() } : n)));
  };

  const handleDelete = (id: string) => {
    const next = notes.filter((n) => n.id !== id);
    saveNotes(next);
    if (activeId === id) setActiveId(next[0]?.id ?? null);
  };

  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [overPos, setOverPos] = useState<"before" | "after" | null>(null);

  const moveNote = (draggedId: string, targetId: string, after: boolean) => {
    if (draggedId === targetId) return;
    const list = [...notes];
    const fromIndex = list.findIndex((n) => n.id === draggedId);
    const targetNote = list.find((n) => n.id === targetId);
    if (fromIndex === -1 || !targetNote || list[fromIndex].grade !== targetNote.grade) return;
    const [item] = list.splice(fromIndex, 1);
    let toIndex = list.findIndex((n) => n.id === targetId);
    toIndex = after ? toIndex + 1 : toIndex;
    list.splice(toIndex, 0, item);
    saveNotes(list);
  };

  const endDrag = () => {
    setDragId(null);
    setOverId(null);
    setOverPos(null);
  };

  return (
    <div>
      <PageHeader title="Методика" subtitle="Как вы объясняете темы: порядок подачи, приёмы, разбор типичных ошибок" />

      <Card className="p-3 mb-4">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <TextInput placeholder="Поиск по теме..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
          </div>
          <div className="w-40">
            <Select value={gradeFilter} onChange={setGradeFilter} options={["Все классы", ...NOTE_GRADES]} />
          </div>
          <div className="w-44">
            <Select value={subjectFilter} onChange={setSubjectFilter} options={["Все предметы", ...ALL_SUBJECTS]} />
          </div>
        </div>
      </Card>

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
                  options={NOTE_GRADES}
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
            {NOTE_GRADES.filter((g) => filteredNotes.some((n) => n.grade === g)).map((g) => (
              <div key={g}>
                <div className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold px-2 pt-3 pb-1">{g}</div>
                {filteredNotes
                  .filter((n) => n.grade === g)
                  .map((n) => (
                    <NoteRow
                      key={n.id}
                      note={n}
                      active={n.id === activeId}
                      dragging={dragId === n.id}
                      dropIndicator={overId === n.id ? overPos : null}
                      onClick={() => setActiveId(n.id)}
                      onDelete={() => handleDelete(n.id)}
                      onDragStart={() => setDragId(n.id)}
                      onDragEndRow={endDrag}
                      onDragOverRow={(pos) => {
                        setOverId(n.id);
                        setOverPos(pos);
                      }}
                      onDropRow={() => {
                        if (dragId) moveNote(dragId, n.id, overPos === "after");
                        endDrag();
                      }}
                    />
                  ))}
              </div>
            ))}
            {filteredNotes.filter((n) => !NOTE_GRADES.includes(n.grade)).map((n) => (
              <NoteRow
                key={n.id}
                note={n}
                active={n.id === activeId}
                dragging={dragId === n.id}
                dropIndicator={overId === n.id ? overPos : null}
                onClick={() => setActiveId(n.id)}
                onDelete={() => handleDelete(n.id)}
                onDragStart={() => setDragId(n.id)}
                onDragEndRow={endDrag}
                onDragOverRow={(pos) => {
                  setOverId(n.id);
                  setOverPos(pos);
                }}
                onDropRow={() => {
                  if (dragId) moveNote(dragId, n.id, overPos === "after");
                  endDrag();
                }}
              />
            ))}
            {filteredNotes.length === 0 && !creating && (
              <p className="text-xs text-gray-400 px-2 py-4">
                {notes.length === 0 ? "Нет тем. Начните с той, что объясняете чаще всего." : "Ничего не найдено по этим фильтрам."}
              </p>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {active ? (
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-y-1.5">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  {editingTopic ? (
                    <TextInput
                      autoFocus
                      value={topicDraft}
                      onChange={(e) => setTopicDraft(e.target.value)}
                      onBlur={handleRenameTopic}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRenameTopic();
                        if (e.key === "Escape") setEditingTopic(false);
                      }}
                      className="font-bold text-lg py-1"
                    />
                  ) : (
                    <h3
                      className="font-bold text-lg cursor-text hover:bg-gray-50 rounded px-1 -mx-1"
                      onClick={startEditTopic}
                      title="Нажмите, чтобы переименовать тему"
                    >
                      {active.topic}
                    </h3>
                  )}
                  {active.grade && <Pill tone="level">{active.grade}</Pill>}
                  {active.subject && <Pill>{displaySubject(active.subject)}</Pill>}
                </div>
                <div className="flex items-center gap-2">
                  {relatedCount > 0 && <Pill tone="type">{relatedCount} задач в базе</Pill>}
                  <button
                    onClick={() => {
                      if (window.confirm(`Удалить тему «${active.topic}»?`)) handleDelete(active.id);
                    }}
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition"
                    title="Удалить тему"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="flex gap-1 mb-4 border-b border-[#F0F1F4] overflow-x-auto">
                {TAB_ORDER.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3.5 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition ${
                      activeTab === tab ? "border-[#2563EB] text-[#2563EB]" : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {TAB_LABELS[tab]}
                  </button>
                ))}
              </div>

              <TextArea
                key={activeTab}
                className="min-h-[300px] text-sm"
                placeholder={TAB_PLACEHOLDERS[activeTab]}
                value={draftTabs[activeTab]}
                onChange={(e) => setDraftTabs((t) => ({ ...t, [activeTab]: e.target.value }))}
                onBlur={handleSaveDraft}
              />

              <div className="mt-4">
                <AttachmentsField
                  attachments={active.attachments?.[activeTab] || []}
                  onChange={(next) => handleAttachmentsChange(activeTab, next)}
                />
              </div>

              <div className="flex justify-end mt-4">
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

function NoteRow({
  note,
  active,
  dragging,
  dropIndicator,
  onClick,
  onDelete,
  onDragStart,
  onDragEndRow,
  onDragOverRow,
  onDropRow,
}: {
  note: MethodNote;
  active: boolean;
  dragging: boolean;
  dropIndicator: "before" | "after" | null;
  onClick: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEndRow: () => void;
  onDragOverRow: (pos: "before" | "after") => void;
  onDropRow: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEndRow}
      onDragOver={(e) => {
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        onDragOverRow(e.clientY - rect.top > rect.height / 2 ? "after" : "before");
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDropRow();
      }}
      onClick={onClick}
      className={`group flex items-center gap-1 px-1.5 py-2 rounded-lg cursor-pointer text-sm transition-colors border-t-2 border-b-2 ${
        active ? "bg-[#EEF2FF] text-[#2563EB] font-medium" : "text-gray-600 hover:bg-gray-50"
      } ${dragging ? "opacity-40" : ""} ${dropIndicator === "before" ? "border-t-[#2563EB]" : "border-t-transparent"} ${
        dropIndicator === "after" ? "border-b-[#2563EB]" : "border-b-transparent"
      }`}
    >
      <GripVertical size={12} className="text-gray-300 shrink-0 cursor-grab" />
      <span className="truncate flex-1" title={note.topic}>
        {note.topic}
      </span>
      <Trash2
        size={13}
        className="text-gray-300 hover:text-red-500 shrink-0 ml-1"
        onClick={(e) => {
          e.stopPropagation();
          if (window.confirm(`Удалить тему «${note.topic}»?`)) onDelete();
        }}
      />
    </div>
  );
}
