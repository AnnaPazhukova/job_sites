import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Bell,
  BookOpen,
  Calendar,
  CheckCircle2,
  Layers,
  LogOut,
  MessageCircle,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useStore } from "./lib/storage";
import { isLessonPast } from "./lib/utils";
import { SEED_NOTES_DATA, SEED_TASKS_DATA } from "./data/seedContent";
import type { Group, Homework, Lesson, MessagesByStudent, MethodNote, Student, Task, ViewId, WeeklyTemplateSlot } from "./lib/types";

import { StudentsView } from "./views/StudentsView";
import { StudentDetailPage } from "./views/StudentDetailView";
import { GroupsView } from "./views/GroupsView";
import { ScheduleView } from "./views/ScheduleView";
import { MessagesView } from "./views/MessagesView";
import { HomeworkView } from "./views/HomeworkView";
import { TasksView } from "./views/TasksView";
import { NotesView } from "./views/NotesView";
import { StatsView } from "./views/StatsView";

const NAV_ITEMS: { id: ViewId; label: string; icon: LucideIcon; disabled?: boolean }[] = [
  { id: "students", label: "Мои ученики", icon: Users },
  { id: "schedule", label: "Расписание", icon: Calendar },
  { id: "messages", label: "Сообщения", icon: MessageCircle },
  { id: "homework", label: "Проверка ДЗ", icon: BookOpen },
  { id: "tasks", label: "База заданий", icon: BookOpen, disabled: true },
  { id: "notes", label: "Методика", icon: Layers },
  { id: "stats", label: "Статистика", icon: TrendingUp },
];

interface AppProps {
  userEmail?: string;
  onSignOut?: () => void;
}

export default function App({ userEmail, onSignOut }: AppProps) {
  const [view, setView] = useState<ViewId>("students");
  const [studentsTab, setStudentsTab] = useState<"students" | "groups">("students");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [students, setStudents, studentsLoaded] = useStore<Student[]>("students", []);
  const [groups, setGroups] = useStore<Group[]>("groups", []);
  const [lessons, setLessons] = useStore<Lesson[]>("lessons", []);
  const [weeklyTemplate, setWeeklyTemplate] = useStore<WeeklyTemplateSlot[]>("weekly-template", []);
  const [homework, setHomework] = useStore<Homework[]>("homework", []);
  const [messages, setMessages] = useStore<MessagesByStudent>("messages", {});
  const [tasks, saveTasks] = useStore<Task[]>("tasks", []);
  const [notes, saveNotes] = useStore<MethodNote[]>("methodology-notes", []);
  const [seedFlags, saveSeedFlags, seedFlagsLoaded] = useStore<Record<string, boolean>>("seed-flags", {});

  const showToast = useCallback((text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 2200);
  }, []);

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);

  const openNote = useCallback((id: string) => {
    setActiveNoteId(id);
    setView("notes");
  }, []);

  // Seed the task bank & methodology library once, on first run.
  useEffect(() => {
    if (!seedFlagsLoaded) return;
    if (seedFlags.contentV1) return;
    saveTasks([...tasks, ...SEED_TASKS_DATA]);
    saveNotes([...notes, ...SEED_NOTES_DATA]);
    saveSeedFlags({ ...seedFlags, contentV1: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedFlagsLoaded]);

  const pendingHw = homework.filter((h) => h.status === "submitted").length;
  const dueUnpaid = lessons.filter((l) => l.status !== "cancelled" && l.paymentStatus !== "paid" && isLessonPast(l)).length;

  function handleBellClick() {
    const total = pendingHw + dueUnpaid;
    showToast(total === 0 ? "Новых уведомлений нет" : `Непроверенных ДЗ: ${pendingHw}, ожидают оплаты: ${dueUnpaid}`);
  }

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }} className="min-h-screen bg-[#F7F8FA] text-[#111827]">
      <header className="sticky top-0 z-30 bg-white border-b border-[#E7E9EE]">
        <div className="flex items-center justify-between px-4 sm:px-6 h-16">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-gray-100" onClick={() => setSidebarOpen((s) => !s)} aria-label="Меню">
              <div className="w-5 flex flex-col gap-1">
                <span className="h-0.5 bg-gray-700 rounded" />
                <span className="h-0.5 bg-gray-700 rounded" />
                <span className="h-0.5 bg-gray-700 rounded" />
              </div>
            </button>
            <div className="text-2xl font-extrabold tracking-tight">
              <span className="text-[#2563EB]">Tutor</span>
              <span className="text-[#111827]">Space</span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {userEmail && <span className="hidden sm:inline text-sm text-gray-500 truncate max-w-[180px]">{userEmail}</span>}
            <button onClick={handleBellClick} className="relative p-2.5 rounded-full hover:bg-gray-100 text-gray-500 transition">
              <Bell size={20} strokeWidth={1.8} />
              {pendingHw + dueUnpaid > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />}
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside
          className={`
          fixed lg:sticky top-16 lg:top-16 left-0 z-20
          h-[calc(100vh-4rem)] w-64 shrink-0
          overflow-y-auto overscroll-contain
          bg-white lg:bg-transparent border-r border-[#E7E9EE] lg:border-r-0
          flex flex-col justify-between px-3 py-5
          transition-transform duration-200
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
        >
          <nav className="space-y-0.5">
            {NAV_ITEMS.map((item) => (
              <NavButton
                key={item.id}
                item={item}
                active={view === item.id || (view === "student-detail" && item.id === "students")}
                onClick={() => {
                  if (item.disabled) return;
                  setView(item.id);
                  setSidebarOpen(false);
                }}
              />
            ))}
          </nav>
          <nav className="pt-4 border-t border-[#E7E9EE] mt-4">
            <button
              onClick={() => (onSignOut ? onSignOut() : showToast("Вы вышли из аккаунта"))}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[#DC2626] hover:bg-red-50 transition text-[15px] font-medium"
            >
              <LogOut size={19} strokeWidth={2} />
              Выход
            </button>
          </nav>
        </aside>

        {sidebarOpen && <div className="fixed inset-0 bg-black/30 z-10 lg:hidden" onClick={() => setSidebarOpen(false)} />}

        <main className="flex-1 min-w-0 px-4 sm:px-6 py-6 max-w-[1400px]">
          {!studentsLoaded ? (
            <div className="py-24 text-center text-gray-400">Загрузка данных...</div>
          ) : (
            <>
              {view === "students" && (
                <div>
                  <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-gray-100 mb-4">
                    <SegTab active={studentsTab === "students"} onClick={() => setStudentsTab("students")}>
                      Ученики
                    </SegTab>
                    <SegTab active={studentsTab === "groups"} onClick={() => setStudentsTab("groups")}>
                      Группы
                    </SegTab>
                  </div>
                  {studentsTab === "students" ? (
                    <StudentsView
                      students={students}
                      setStudents={setStudents}
                      groups={groups}
                      lessons={lessons}
                      setView={setView}
                      showToast={showToast}
                      setSelectedStudentId={setSelectedStudentId}
                    />
                  ) : (
                    <GroupsView groups={groups} setGroups={setGroups} students={students} showToast={showToast} />
                  )}
                </div>
              )}
              {view === "student-detail" && (
                <StudentDetailPage
                  students={students}
                  setStudents={setStudents}
                  lessons={lessons}
                  setLessons={setLessons}
                  homework={homework}
                  setHomework={setHomework}
                  messages={messages}
                  setMessages={setMessages}
                  notes={notes}
                  selectedStudentId={selectedStudentId}
                  setView={setView}
                  showToast={showToast}
                />
              )}
              {view === "schedule" && (
                <ScheduleView
                  lessons={lessons}
                  setLessons={setLessons}
                  students={students}
                  setStudents={setStudents}
                  groups={groups}
                  weeklyTemplate={weeklyTemplate}
                  setWeeklyTemplate={setWeeklyTemplate}
                  homework={homework}
                  setHomework={setHomework}
                  messages={messages}
                  setMessages={setMessages}
                  notes={notes}
                  showToast={showToast}
                />
              )}
              {view === "messages" && <MessagesView students={students} messages={messages} setMessages={setMessages} />}
              {view === "homework" && (
                <HomeworkView
                  homework={homework}
                  setHomework={setHomework}
                  students={students}
                  lessons={lessons}
                  notes={notes}
                  onOpenNote={openNote}
                  showToast={showToast}
                />
              )}
              {view === "tasks" && <TasksView tasks={tasks} saveTasks={saveTasks} showToast={showToast} />}
              {view === "notes" && (
                <NotesView notes={notes} saveNotes={saveNotes} tasks={tasks} showToast={showToast} activeId={activeNoteId} setActiveId={setActiveNoteId} />
              )}
              {view === "stats" && <StatsView lessons={lessons} students={students} homework={homework} tasks={tasks} notes={notes} setView={setView} />}
            </>
          )}
        </main>
      </div>

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-[#111827] text-white text-sm px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-[fadeIn_0.15s_ease]">
          <CheckCircle2 size={16} className="text-emerald-400" />
          {toast}
        </div>
      )}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translate(-50%, 8px);} to { opacity:1; transform: translate(-50%,0);} }
      `}</style>
    </div>
  );
}

function SegTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
        active ? "bg-white text-[#2563EB] shadow-sm" : "text-gray-500 hover:text-gray-700"
      }`}
    >
      {children}
    </button>
  );
}

function NavButton({
  item,
  active,
  onClick,
}: {
  item: { id: ViewId; label: string; icon: LucideIcon; disabled?: boolean };
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      disabled={item.disabled}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition text-[15px] font-medium
        ${item.disabled ? "text-gray-300 cursor-not-allowed" : active ? "bg-[#EEF2FF] text-[#2563EB]" : "text-[#4B5563] hover:bg-gray-50"}`}
    >
      <Icon size={19} strokeWidth={2} />
      {item.label}
      {item.disabled && <span className="ml-auto text-[10px] uppercase tracking-wide text-gray-300">Скоро</span>}
    </button>
  );
}
