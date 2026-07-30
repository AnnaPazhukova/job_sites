import { useEffect, useMemo, useState } from "react";
import { Check, Layers, ListPlus, Plus, Search, Trash2, X } from "lucide-react";
import { Card, GhostButton, Modal, PageHeader, Pill, PrimaryButton, Select, TextArea, TextInput } from "../components/ui";
import { AttachmentsField } from "../components/Attachments";
import { GRADES, uid } from "../lib/utils";
import type { Attachment, MethodNote, MethodNoteAttachments, MethodNoteTabKey, MethodNoteTabs, Task } from "../lib/types";

const subjectsForGrade = (grade: string) => {
  if (grade === "5 класс" || grade === "6 класс") return ["Математика"];
  if (grade === "9 класс") return ["Алгебра", "Геометрия", "Подготовка к ОГЭ"];
  return ["Алгебра", "Геометрия"];
};
const ALL_SUBJECTS = ["Математика", "Алгебра", "Геометрия", "Подготовка к ОГЭ"];
const NOTE_GRADES = GRADES.filter((g) => g !== "10 класс" && g !== "11 класс");

const OGE_PREP_TEMPLATE = `Работа с текстом задания: чтение условия, планы участков, схемы
Вычисления по условию текста (задания 1–5), единицы измерения
Задание 6 — числа и вычисления: действия с обыкновенными и десятичными дробями
Задание 6 — числа и вычисления: степени, стандартный вид числа, проценты
Задание 7 — числовые неравенства, координатная прямая: сравнение чисел, отметка на координатной прямой, свойства неравенств
Задание 8 — алгебраические выражения: формулы сокращённого умножения
Задание 8 — алгебраические выражения: преобразование выражений и дробей
Задание 9 — уравнения и системы: линейные уравнения и системы
Задание 9 — уравнения и системы: квадратные уравнения
Задание 9 — уравнения и системы: дробно-рациональные уравнения
Задание 10 — статистика и вероятности: классическая вероятность
Задание 10 — статистика и вероятности: комбинаторика, круги Эйлера
Задание 11 — графики функций: линейная функция и её график
Задание 11 — графики функций: квадратичная функция, парабола
Задание 11 — графики функций: обратная пропорциональность (гипербола)
Задание 12 — расчёты по формулам: прикладные формулы (тарифы, физические величины)
Задание 13 — неравенства и системы: линейные неравенства
Задание 13 — неравенства и системы: квадратные неравенства, метод интервалов
Задание 13 — неравенства и системы: системы неравенств
Задание 14 — прогрессии: арифметическая прогрессия
Задание 14 — прогрессии: геометрическая прогрессия
Задание 15 — треугольники и многоугольники: признаки равенства, свойства треугольников
Задание 15 — треугольники и многоугольники: теорема Пифагора, тригонометрия прямоугольного треугольника
Задание 15 — треугольники и многоугольники: подобие треугольников
Задание 15 — треугольники и многоугольники: параллелограмм, трапеция и их свойства
Задание 16 — окружность и круг: хорды, касательные, центральные и вписанные углы
Задание 16 — окружность и круг: вписанная и описанная окружности
Задание 17 — площади фигур: площади треугольников и четырёхугольников
Задание 17 — площади фигур: площади фигур сложной формы, круга и его частей
Задание 18 — фигуры на решётке: площади и длины на клетчатой бумаге
Задание 18 — фигуры на решётке: углы, построение и измерение фигур
Задание 19 — анализ геометрических утверждений: разбор верных/неверных утверждений
Задание 20: сложные уравнения и неравенства повышенного уровня
Задание 21: текстовые задачи (движение, работа, смеси)
Задание 22: функции и их свойства, построение и анализ графиков
Задание 23: геометрическая задача на вычисление
Задание 24: геометрическая задача на доказательство
Задание 25: комплексная геометрическая задача повышенной сложности
Сводное повторение части 1 (задания 1–19): разбор сложных случаев по темам
Сводное повторение части 2 (задания 20–25): разбор сложных случаев по темам`;

const ALGEBRA_7_TEMPLATE = `Рациональные числа: повторение, действия
Числовые выражения
Выражения с переменными
Сравнение значений выражений
Свойства действий над числами
Тождества, тождественные преобразования выражений (практика)
Уравнение и его корни
Линейное уравнение с одной переменной
Решение задач с помощью уравнений (часть 1)
Решение задач с помощью уравнений (часть 2)
Формулы, выражение переменной из формулы
Контрольная работа №1 + разбор ошибок
Числовые промежутки
Что такое функция, область определения
Вычисление значений функции по формуле
График функции
Прямая пропорциональность и её график
Линейная функция и её график
Кусочно-заданные функции; контрольная работа №2
Определение степени с натуральным показателем
Умножение и деление степеней
Возведение в степень произведения и степени (практика)
Одночлен и его стандартный вид
Умножение одночленов
Возведение одночлена в степень
Функции у = x² и y = x³ и их графики; простые и составные числа; контрольная работа №3
Многочлен и его стандартный вид
Сложение и вычитание многочленов
Умножение одночлена на многочлен
Вынесение общего множителя за скобки (практика)
Умножение многочлена на многочлен
Разложение многочлена на множители способом группировки
Деление с остатком; контрольная работа №4
Квадрат суммы и квадрат разности
Разложение на множители с помощью квадрата суммы и разности
Практика: применение квадрата суммы/разности в вычислениях
Умножение разности двух выражений на их сумму
Разложение разности квадратов на множители
Практика: разность квадратов в комбинированных заданиях
Сумма и разность кубов, разложение на множители
Преобразование целого выражения в многочлен
Применение различных способов разложения на множители (сводная практика)
Возведение двучлена в степень; контрольная работа №5
Линейное уравнение с двумя переменными; график
Системы линейных уравнений с двумя переменными
Решение систем способом подстановки
Решение систем способом сложения
Решение задач с помощью систем уравнений (практика)
Линейные неравенства с двумя переменными и их системы
Итоговая контрольная работа за год + разбор`;

const BULK_TEMPLATES: Record<string, string> = {
  "9 класс|Подготовка к ОГЭ": OGE_PREP_TEMPLATE,
  "7 класс|Алгебра": ALGEBRA_7_TEMPLATE,
};

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

function isNoteEmpty(note: MethodNote): boolean {
  const tabs = getTabs(note);
  const hasText = TAB_ORDER.some((k) => tabs[k]?.trim());
  const hasAttachments = TAB_ORDER.some((k) => (note.attachments?.[k]?.length ?? 0) > 0);
  return !hasText && !hasAttachments;
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
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const active = notes.find((n) => n.id === activeId) || null;

  const [activeTab, setActiveTab] = useState<MethodNoteTabKey>("theory");
  const [draftTabs, setDraftTabs] = useState<MethodNoteTabs>(getTabs(active));

  useEffect(() => {
    setDraftTabs(getTabs(active));
    setActiveTab("theory");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const [gradeFilter, setGradeFilter] = useState("Все классы");
  const [subjectFilter, setSubjectFilter] = useState("Все предметы");
  const [query, setQuery] = useState("");

  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      if (gradeFilter !== "Все классы" && n.grade !== gradeFilter) return false;
      if (subjectFilter !== "Все предметы" && n.subject !== subjectFilter) return false;
      if (query.trim() && !n.topic.toLowerCase().includes(query.trim().toLowerCase())) return false;
      return true;
    });
  }, [notes, gradeFilter, subjectFilter, query]);

  const relatedCount = active ? tasks.filter((t) => t.topic === active.topic).length : 0;
  const emptyCount = useMemo(() => notes.filter(isNoteEmpty).length, [notes]);

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

  const handleBulkAdd = (grade: string, subject: string, lines: string[]) => {
    const newNotes = lines.map((topic) => ({ ...emptyNote(), topic, grade, subject }));
    if (newNotes.length === 0) return;
    saveNotes([...notes, ...newNotes]);
    setShowBulkAdd(false);
    showToast(`Добавлено тем: ${newNotes.length}`);
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
          {emptyCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Не заполнено тем: {emptyCount}
            </span>
          )}
        </div>
      </Card>

      <div className="flex gap-4 flex-col md:flex-row">
        <div className="md:w-[260px] shrink-0">
          <PrimaryButton icon={Plus} full onClick={() => setCreating(true)}>
            Тема методики
          </PrimaryButton>
          <div className="mt-2">
            <GhostButton icon={ListPlus} full onClick={() => setShowBulkAdd(true)}>
              Добавить список тем
            </GhostButton>
          </div>
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
                      empty={isNoteEmpty(n)}
                      onClick={() => setActiveId(n.id)}
                      onDelete={() => handleDelete(n.id)}
                    />
                  ))}
              </div>
            ))}
            {filteredNotes.filter((n) => !NOTE_GRADES.includes(n.grade)).map((n) => (
              <NoteRow
                key={n.id}
                note={n}
                active={n.id === activeId}
                empty={isNoteEmpty(n)}
                onClick={() => setActiveId(n.id)}
                onDelete={() => handleDelete(n.id)}
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
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-lg">{active.topic}</h3>
                  {active.grade && <Pill tone="level">{active.grade}</Pill>}
                  {active.subject && <Pill>{active.subject}</Pill>}
                  {isNoteEmpty(active) && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[11px] font-semibold uppercase tracking-wide">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Не заполнено
                    </span>
                  )}
                </div>
                {relatedCount > 0 && <Pill tone="type">{relatedCount} задач в базе</Pill>}
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

      {showBulkAdd && <BulkAddModal onClose={() => setShowBulkAdd(false)} onSubmit={handleBulkAdd} />}
    </div>
  );
}

function BulkAddModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (grade: string, subject: string, lines: string[]) => void;
}) {
  const [grade, setGrade] = useState("7 класс");
  const [subject, setSubject] = useState("Алгебра");
  const [text, setText] = useState(ALGEBRA_7_TEMPLATE);

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <Modal title="Добавить список тем" onClose={onClose} wide>
      <div className="space-y-3">
        <div className="flex gap-1.5">
          <Select
            value={grade}
            onChange={(v) => {
              const opts = subjectsForGrade(v);
              const nextSubject = opts.includes(subject) ? subject : opts[0];
              setGrade(v);
              setSubject(nextSubject);
              setText(BULK_TEMPLATES[`${v}|${nextSubject}`] || "");
            }}
            options={NOTE_GRADES}
          />
          <Select
            value={subject}
            onChange={(v) => {
              setSubject(v);
              setText(BULK_TEMPLATES[`${grade}|${v}`] || "");
            }}
            options={subjectsForGrade(grade)}
          />
        </div>
        <TextArea
          className="min-h-[320px] text-sm font-mono"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="По одной теме на строку"
        />
        <div className="text-xs text-gray-400">Тем к добавлению: {lines.length}</div>
        <div className="flex justify-end gap-2">
          <GhostButton onClick={onClose}>Отмена</GhostButton>
          <PrimaryButton icon={ListPlus} onClick={() => onSubmit(grade, subject, lines)} disabled={lines.length === 0}>
            Добавить{lines.length > 0 ? ` (${lines.length})` : ""}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

function NoteRow({
  note,
  active,
  empty,
  onClick,
  onDelete,
}: {
  note: MethodNote;
  active: boolean;
  empty: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`group flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
        active ? "bg-[#EEF2FF] text-[#2563EB] font-medium" : "text-gray-600 hover:bg-gray-50"
      }`}
    >
      <span className="flex items-center gap-1.5 min-w-0">
        {empty && <span title="Тема ещё не заполнена" className="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-400" />}
        <span className="truncate">{note.topic}</span>
      </span>
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
