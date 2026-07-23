import { useCallback, useEffect, useState } from "react";
import { BookOpen, Calendar, Check, CheckCircle2, Clock, Layers, LogOut, MessageCircle, Paperclip, Send, Wallet } from "lucide-react";
import { Avatar, Card, EmptyState, PageHeader } from "./components/ui";
import { fmtDateRu, TODAY_KEY } from "./lib/utils";
import {
  fetchStudentHomework,
  fetchStudentLessons,
  fetchStudentLinkedNotes,
  fetchStudentMessages,
  fetchStudentProfile,
  markStudentHomeworkDone,
  sendStudentMessage,
} from "./lib/studentData";
import type { ChatMessage, Homework, Lesson, MethodNote, Student } from "./lib/types";

type Tab = "schedule" | "messages" | "homework";

interface Props {
  onSignOut: () => void;
}

export default function StudentPortal({ onSignOut }: Props) {
  const [tab, setTab] = useState<Tab>("schedule");
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Student | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [notes, setNotes] = useState<MethodNote[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 2200);
  }, []);

  useEffect(() => {
    (async () => {
      const [p, l, h, n, m] = await Promise.all([
        fetchStudentProfile(),
        fetchStudentLessons(),
        fetchStudentHomework(),
        fetchStudentLinkedNotes(),
        fetchStudentMessages(),
      ]);
      setProfile(p);
      setLessons(l);
      setHomework(h);
      setNotes(n);
      setMessages(m);
      setLoading(false);
    })();
  }, []);

  const upcoming = lessons
    .filter((l) => l.status !== "cancelled" && l.date >= TODAY_KEY)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time?.localeCompare(b.time));
  const past = lessons
    .filter((l) => l.status === "cancelled" || l.date < TODAY_KEY)
    .sort((a, b) => b.date.localeCompare(a.date) || b.time?.localeCompare(a.time));

  async function markDone(id: string) {
    setHomework((hw) => hw.map((h) => (h.id === id ? { ...h, status: "done" } : h)));
    try {
      await markStudentHomeworkDone(id);
      showToast("Отмечено как сделано");
    } catch {
      showToast("Не удалось сохранить, попробуйте ещё раз");
    }
  }

  const TABS: { id: Tab; label: string; icon: typeof Calendar }[] = [
    { id: "schedule", label: "Расписание", icon: Calendar },
    { id: "messages", label: "Сообщения", icon: MessageCircle },
    { id: "homework", label: "Домашние задания", icon: BookOpen },
  ];

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }} className="min-h-screen bg-[#F7F8FA] text-[#111827]">
      <header className="sticky top-0 z-30 bg-white border-b border-[#E7E9EE]">
        <div className="flex items-center justify-between px-4 sm:px-6 h-16">
          <div className="text-2xl font-extrabold tracking-tight">
            <span className="text-[#2563EB]">Tutor</span>
            <span className="text-[#111827]">Space</span>
          </div>
          <div className="flex items-center gap-3">
            {profile && (
              <div className="hidden sm:flex items-center gap-2">
                <Avatar id={profile.id} name={profile.name} size={30} />
                <span className="text-sm font-medium">{profile.name}</span>
              </div>
            )}
            <button onClick={onSignOut} className="p-2.5 rounded-full hover:bg-red-50 text-[#DC2626] transition" aria-label="Выход">
              <LogOut size={19} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[900px] mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="py-24 text-center text-gray-400">Загрузка данных...</div>
        ) : (
          <>
            <PageHeader title={profile ? `Здравствуйте, ${profile.firstName || profile.name}!` : "Личный кабинет"} />

            <div className="flex gap-1 mb-5 border-b border-[#E7E9EE] overflow-x-auto">
              {TABS.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition ${
                      tab === t.id ? "border-[#2563EB] text-[#2563EB]" : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Icon size={15} /> {t.label}
                  </button>
                );
              })}
            </div>

            {tab === "schedule" && (
              <div className="space-y-5">
                <div>
                  <div className="font-semibold text-sm text-gray-500 mb-2">Ближайшие занятия</div>
                  {upcoming.length === 0 ? (
                    <EmptyState icon={Calendar} title="Занятий не запланировано" />
                  ) : (
                    <Card className="divide-y divide-[#F0F1F4]">
                      {upcoming.map((l) => (
                        <LessonRow key={l.id} lesson={l} />
                      ))}
                    </Card>
                  )}
                </div>
                {past.length > 0 && (
                  <div>
                    <div className="font-semibold text-sm text-gray-500 mb-2">Прошедшие занятия</div>
                    <Card className="divide-y divide-[#F0F1F4]">
                      {past.slice(0, 20).map((l) => (
                        <LessonRow key={l.id} lesson={l} />
                      ))}
                    </Card>
                  </div>
                )}
              </div>
            )}

            {tab === "messages" && <MessagesTab messages={messages} setMessages={setMessages} showToast={showToast} />}

            {tab === "homework" && (
              <div>
                {homework.length === 0 ? (
                  <EmptyState icon={BookOpen} title="Домашних заданий пока нет" />
                ) : (
                  <Card className="divide-y divide-[#F0F1F4]">
                    {homework.map((h) => {
                      const note = h.noteId ? notes.find((n) => n.id === h.noteId) : null;
                      return (
                        <div key={h.id} className="px-4 sm:px-5 py-4">
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="min-w-0">
                              <div className="font-medium text-sm">{h.title}</div>
                              <div className="text-xs text-gray-500 mt-0.5">{h.due ? `срок до ${fmtDateRu(h.due)}` : "без срока"}</div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${
                                  h.status === "done" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                                }`}
                              >
                                {h.status === "done" ? "Сделано" : "В работе"}
                              </span>
                              {h.status !== "done" && (
                                <button onClick={() => markDone(h.id)} className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600">
                                  <Check size={16} />
                                </button>
                              )}
                            </div>
                          </div>
                          {(note || (h.attachments && h.attachments.length > 0)) && (
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              {note && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md bg-blue-50 text-[#2563EB]">
                                  <Layers size={11} /> {note.topic}
                                </span>
                              )}
                              {h.attachments?.map((a) => (
                                <a
                                  key={a.id}
                                  href={a.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200"
                                >
                                  <Paperclip size={11} /> {a.name}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </Card>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-[#111827] text-white text-sm px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-400" />
          {toast}
        </div>
      )}
    </div>
  );
}

function LessonRow({ lesson }: { lesson: Lesson }) {
  const cancelled = lesson.status === "cancelled";
  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3 px-4 sm:px-5 py-3.5">
      <span className="text-sm font-medium w-24 shrink-0">{fmtDateRu(lesson.date)}</span>
      <span className="text-sm text-gray-500 flex items-center gap-1 shrink-0">
        <Clock size={13} /> {lesson.time} · {lesson.duration} мин
      </span>
      <span
        className={`text-xs font-medium px-2.5 py-1 rounded-lg shrink-0 ${cancelled ? "bg-gray-100 text-gray-400" : "bg-blue-50 text-[#2563EB]"}`}
      >
        {cancelled ? "Отменено" : "Запланировано"}
      </span>
      {!cancelled && (
        <span
          className={`text-xs font-medium px-2.5 py-1 rounded-lg flex items-center gap-1 shrink-0 ${
            lesson.paymentStatus === "paid" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-500"
          }`}
        >
          <Wallet size={12} /> {lesson.paymentStatus === "paid" ? "Оплачено" : "Ожидает оплаты"}
        </span>
      )}
    </div>
  );
}

function MessagesTab({
  messages,
  setMessages,
  showToast,
}: {
  messages: ChatMessage[];
  setMessages: (m: ChatMessage[]) => void;
  showToast: (t: string) => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    const optimistic: ChatMessage = { id: `local-${Date.now()}`, from: "student", text: value, at: Date.now() };
    setMessages([...messages, optimistic]);
    setText("");
    try {
      await sendStudentMessage(value);
    } catch {
      setMessages(messages.filter((m) => m.id !== optimistic.id));
      showToast("Не удалось отправить сообщение");
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className="flex flex-col" style={{ minHeight: 460 }}>
      <div className="flex-1 p-4 space-y-2 overflow-y-auto" style={{ maxHeight: 420 }}>
        {messages.length === 0 && <div className="text-center text-gray-400 text-sm py-10">Сообщений пока нет</div>}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-sm ${m.from === "student" ? "bg-[#2563EB] text-white ml-auto rounded-br-sm" : "bg-gray-100 rounded-bl-sm"}`}
          >
            {m.text}
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-[#F0F1F4] flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Написать сообщение..."
          className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#F7F8FA] border border-[#E7E9EE] text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
        />
        <button onClick={send} disabled={sending} className="bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white p-2.5 rounded-xl">
          <Send size={17} />
        </button>
      </div>
    </Card>
  );
}
