import { useEffect, useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { Avatar, Card, EmptyState, PageHeader } from "../components/ui";
import { uid } from "../lib/utils";
import type { MessagesByStudent, Student } from "../lib/types";

interface Props {
  students: Student[];
  messages: MessagesByStudent;
  setMessages: (m: MessagesByStudent) => void;
}

export function MessagesView({ students, messages, setMessages }: Props) {
  const [activeId, setActiveId] = useState<string | null>(students[0]?.id || null);
  const [text, setText] = useState("");

  useEffect(() => {
    if (!activeId && students[0]) setActiveId(students[0].id);
  }, [students, activeId]);

  const thread = (activeId && messages[activeId]) || [];

  function send() {
    if (!text.trim() || !activeId) return;
    const next = { ...messages, [activeId]: [...thread, { id: uid(), from: "me" as const, text: text.trim(), at: Date.now() }] };
    setMessages(next);
    setText("");
  }

  if (students.length === 0) {
    return (
      <div>
        <PageHeader title="Сообщения" />
        <EmptyState icon={MessageCircle} title="Переписок пока нет" subtitle="Добавьте учеников на странице «Мои ученики», чтобы начать общение" />
      </div>
    );
  }

  const activeStudent = students.find((s) => s.id === activeId);

  return (
    <div>
      <PageHeader title="Сообщения" />
      <Card className="grid grid-cols-1 sm:grid-cols-[260px_1fr] overflow-hidden" style={{ minHeight: 480 }}>
        <div className="border-b sm:border-b-0 sm:border-r border-[#F0F1F4] max-h-64 sm:max-h-none overflow-y-auto">
          {students.map((s) => {
            const last = (messages[s.id] || []).slice(-1)[0];
            return (
              <button
                key={s.id}
                onClick={() => setActiveId(s.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-[#F7F8FA] hover:bg-[#FAFBFC] ${activeId === s.id ? "bg-[#EEF2FF]" : ""}`}
              >
                <Avatar id={s.id} name={s.name} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{s.name}</div>
                  <div className="text-xs text-gray-400 truncate">{last ? last.text : "Нет сообщений"}</div>
                </div>
              </button>
            );
          })}
        </div>
        <div className="flex flex-col">
          <div className="px-4 py-3 border-b border-[#F0F1F4] font-semibold text-sm flex items-center gap-2">
            {activeStudent && <Avatar id={activeStudent.id} name={activeStudent.name} size={28} />}
            {activeStudent?.name}
          </div>
          <div className="flex-1 p-4 space-y-2 overflow-y-auto" style={{ maxHeight: 340 }}>
            {thread.length === 0 && <div className="text-center text-gray-400 text-sm py-10">Начните переписку с {activeStudent?.name}</div>}
            {thread.map((m) => (
              <div key={m.id} className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-sm ${m.from === "me" ? "bg-[#2563EB] text-white ml-auto rounded-br-sm" : "bg-gray-100 rounded-bl-sm"}`}>
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
            <button onClick={send} className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white p-2.5 rounded-xl">
              <Send size={17} />
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
