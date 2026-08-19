import { useCallback, useEffect, useState } from "react";
import { BookOpen, Calendar, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Layers, LogOut, MessageCircle, Paperclip, Send } from "lucide-react";
import { Avatar, Card, EmptyState, GhostButton, Modal, PageHeader, PrimaryButton } from "./components/ui";
import { AttachmentList, AttachmentsField, LargeAttachmentList } from "./components/Attachments";
import { MiniCalendar } from "./components/MiniCalendar";
import { durationLabel, fmtDateRu, isLessonPast, MONTHS_RU, normalizeHomeworkStatus, TODAY } from "./lib/utils";
import { getWeekDays, WeekView } from "./views/WeekView";
import {
  fetchStudentHomework,
  fetchStudentLessons,
  fetchStudentLinkedNotes,
  fetchStudentMessages,
  fetchStudentProfile,
  markStudentHomeworkDone,
  requestLessonCancel,
  sendStudentMessage,
} from "./lib/studentData";
import type { Attachment, ChatMessage, Homework, HomeworkStatus, Lesson, MethodNote, Student } from "./lib/types";

type Tab = "schedule" | "messages" | "homework";
type DetailTab = "record" | "info" | "homework";

// Whatever the student clicked — a homework item, a conducted lesson, or
// both linked together — opens the same detail view. A lesson's homework
// is resolved separately since either side can be missing (a lesson with
// no homework assigned yet, or homework with no linked lesson).
interface DetailTarget {
  lesson?: Lesson;
  homework?: Homework;
  initialTab: DetailTab;
}

const HW_STATUS_META: Record<HomeworkStatus, { label: string; color: string }> = {
  assigned: { label: "Не сдано", color: "bg-gray-100 text-gray-500" },
  submitted: { label: "На проверке", color: "bg-amber-50 text-amber-600" },
  done: { label: "Проверено", color: "bg-emerald-50 text-emerald-600" },
};

// New, not-yet-submitted homework needs attention first — surface it above
// anything already sent off or already reviewed.
const HW_SORT_ORDER: Record<HomeworkStatus, number> = { assigned: 0, submitted: 1, done: 2 };

// Homework has no createdAt field, but new items are always appended to the
// stored array (see App.tsx/HomeworkView.tsx's setHomework([...homework,
// created])), so array position already reflects true assignment order —
// reversing it puts the newest first. Array.prototype.sort is stable, so
// the status grouping below doesn't disturb that newest-first order within
// each group.
function sortedHomework(homework: Homework[]): Homework[] {
  return [...homework].reverse().sort((a, b) => HW_SORT_ORDER[normalizeHomeworkStatus(a.status)] - HW_SORT_ORDER[normalizeHomeworkStatus(b.status)]);
}

// A student is unlikely to ever revisit homework the tutor has already
// reviewed — split it off into a collapsed section so the list opens on
// what still needs attention.
function HomeworkTabContent({
  homework,
  lessons,
  notes,
  onOpen,
}: {
  homework: Homework[];
  lessons: Lesson[];
  notes: MethodNote[];
  onOpen: (lesson: Lesson | null, h: Homework) => void;
}) {
  const [showDone, setShowDone] = useState(false);

  if (homework.length === 0) {
    return <EmptyState icon={BookOpen} title="Домашних заданий пока нет" />;
  }

  const active = sortedHomework(homework.filter((h) => normalizeHomeworkStatus(h.status) !== "done"));
  const done = sortedHomework(homework.filter((h) => normalizeHomeworkStatus(h.status) === "done"));

  return (
    <div className="space-y-5">
      {active.length > 0 ? (
        <Card className="divide-y divide-[#F0F1F4]">
          {active.map((h) => (
            <HomeworkRow key={h.id} h={h} lessons={lessons} notes={notes} onOpen={onOpen} />
          ))}
        </Card>
      ) : (
        <div className="py-10 text-center text-gray-400 text-sm">Невыполненных заданий нет 🎉</div>
      )}

      {done.length > 0 && (
        <div>
          <button
            onClick={() => setShowDone((s) => !s)}
            className="w-full flex items-center justify-between px-1 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition"
          >
            <span>Выполненные ({done.length})</span>
            <ChevronDown size={16} className={`transition-transform ${showDone ? "rotate-180" : ""}`} />
          </button>
          {showDone && (
            <Card className="divide-y divide-[#F0F1F4] mt-2">
              {done.map((h) => (
                <HomeworkRow key={h.id} h={h} lessons={lessons} notes={notes} onOpen={onOpen} />
              ))}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function HomeworkRow({
  h,
  lessons,
  notes,
  onOpen,
}: {
  h: Homework;
  lessons: Lesson[];
  notes: MethodNote[];
  onOpen: (lesson: Lesson | null, h: Homework) => void;
}) {
  const note = h.noteId ? notes.find((n) => n.id === h.noteId) : null;
  const lesson = h.lessonId ? lessons.find((l) => l.id === h.lessonId) : null;
  const status = normalizeHomeworkStatus(h.status);
  const needsAttachment = status === "assigned";

  return (
    <div onClick={() => onOpen(lesson || null, h)} className="px-4 sm:px-5 py-4 cursor-pointer hover:bg-gray-50 transition">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="font-medium text-sm">{h.title}</div>
          <div className="text-xs text-gray-500 mt-0.5">{h.due ? `срок до ${fmtDateRu(h.due)}` : "без срока"}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {h.grade != null && (
            <span className="w-8 h-8 flex items-center justify-center rounded-full bg-[#EEF2FF] text-[#2563EB] text-sm font-bold">{h.grade}</span>
          )}
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${HW_STATUS_META[status].color}`}>{HW_STATUS_META[status].label}</span>
        </div>
      </div>
      {(note || lesson || (h.attachments && h.attachments.length > 0) || needsAttachment) && (
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {note && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md bg-blue-50 text-[#2563EB]">
              <Layers size={11} /> {note.topic}
            </span>
          )}
          {lesson && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md bg-emerald-50 text-emerald-700">
              <Calendar size={11} /> урок {fmtDateRu(lesson.date)}
            </span>
          )}
          {h.attachments && h.attachments.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md bg-gray-100 text-gray-600">
              <Paperclip size={11} /> {h.attachments.length} {h.attachments.length === 1 ? "файл" : "файла"}
            </span>
          )}
          {needsAttachment && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md bg-amber-50 text-amber-700">
              Прикрепите фото, чтобы сдать
            </span>
          )}
        </div>
      )}
      {h.reviewComment && (
        <div className="mt-2.5 px-3 py-2 rounded-lg bg-blue-50 text-sm text-gray-700">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[#2563EB] mb-0.5">Комментарий преподавателя</div>
          {h.reviewComment}
        </div>
      )}
    </div>
  );
}

interface Props {
  code: string;
  onExit: () => void;
}

export default function StudentPortal({ code, onExit }: Props) {
  const [tab, setTab] = useState<Tab>("schedule");
  const [weekCursor, setWeekCursor] = useState(TODAY);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Student | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [notes, setNotes] = useState<MethodNote[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<"invalid" | "setup" | null>(null);
  const [openDetail, setOpenDetail] = useState<DetailTarget | null>(null);
  const [openUpcoming, setOpenUpcoming] = useState<Lesson | null>(null);

  const showToast = useCallback((text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 2200);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [p, l, h, n, m] = await Promise.all([
          fetchStudentProfile(code),
          fetchStudentLessons(code),
          fetchStudentHomework(code),
          fetchStudentLinkedNotes(code),
          fetchStudentMessages(code),
        ]);
        setProfile(p);
        setLessons(l);
        setHomework(h);
        setNotes(n);
        setMessages(m);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        // A missing-function/schema-cache error means the database wasn't
        // migrated to this version yet — very different from a genuinely
        // revoked/wrong link, so it shouldn't show the same message.
        setLoadError(/does not exist|schema cache|not find the function/i.test(msg) ? "setup" : "invalid");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const weekDays = getWeekDays(weekCursor);
  const weekLabel = `${weekDays[0].getDate()} ${MONTHS_RU[weekDays[0].getMonth()].toLowerCase()} – ${weekDays[6].getDate()} ${MONTHS_RU[weekDays[6].getMonth()].toLowerCase()}`;

  function goPrevWeek() {
    setWeekCursor((c) => {
      const d = new Date(c);
      d.setDate(d.getDate() - 7);
      return d;
    });
  }

  function goNextWeek() {
    setWeekCursor((c) => {
      const d = new Date(c);
      d.setDate(d.getDate() + 7);
      return d;
    });
  }

  async function submitHomework(id: string, attachments: Attachment[]) {
    setHomework((hw) => hw.map((h) => (h.id === id ? { ...h, status: "submitted", submissionAttachments: attachments } : h)));
    setOpenDetail((d) =>
      d && d.homework?.id === id ? { ...d, homework: { ...d.homework, status: "submitted", submissionAttachments: attachments } } : d
    );
    try {
      await markStudentHomeworkDone(code, id, attachments);
      showToast("Отправлено репетитору на проверку");
    } catch {
      showToast("Не удалось сохранить, попробуйте ещё раз");
    }
  }

  async function requestCancel(lessonId: string) {
    setLessons((ls) => ls.map((l) => (l.id === lessonId ? { ...l, cancelRequested: true } : l)));
    setOpenUpcoming((l) => (l && l.id === lessonId ? { ...l, cancelRequested: true } : l));
    try {
      await requestLessonCancel(code, lessonId);
      showToast("Запрос на отмену отправлен репетитору");
    } catch {
      showToast("Не удалось отправить запрос, попробуйте ещё раз");
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
                <Avatar id={profile.id} name={profile.name} size={30} color={profile.color} />
                <span className="text-sm font-medium">{profile.name}</span>
              </div>
            )}
            <button onClick={onExit} className="p-2.5 rounded-full hover:bg-red-50 text-[#DC2626] transition" aria-label="Выход">
              <LogOut size={19} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[900px] mx-auto px-4 sm:px-6 py-6">
        {loadError === "setup" ? (
          <div className="py-24 text-center text-gray-500">
            <div className="font-semibold text-lg mb-1">Кабинет временно недоступен</div>
            <div className="text-sm">Похоже, сайт обновился, а база данных — ещё нет. Попросите репетитора выполнить обновлённый supabase/schema.sql и попробуйте снова.</div>
          </div>
        ) : loadError === "invalid" ? (
          <div className="py-24 text-center text-gray-500">
            <div className="font-semibold text-lg mb-1">Ссылка недействительна</div>
            <div className="text-sm">Возможно, репетитор отключил доступ по этой ссылке. Попросите новую.</div>
          </div>
        ) : loading ? (
          <div className="py-24 text-center text-gray-400">Загрузка данных...</div>
        ) : (
          <>
            <PageHeader title={profile ? `Здравствуйте, ${profile.firstName || profile.name}!` : "Личный кабинет"} />

            <div className="flex mb-5 border-b border-[#E7E9EE]">
              {TABS.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 px-2 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
                      tab === t.id ? "border-[#2563EB] text-[#2563EB]" : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Icon size={15} className="shrink-0" />
                    <span className="truncate">{t.label}</span>
                  </button>
                );
              })}
            </div>

            {tab === "schedule" && (
              <div>
                <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                  <div className="text-lg font-bold">{weekLabel}</div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setWeekCursor(TODAY)}
                      className="px-3.5 py-2 rounded-xl bg-white border border-gray-300 shadow-sm text-sm font-medium hover:bg-gray-50 hover:border-gray-400 transition"
                    >
                      Сегодня
                    </button>
                    <div className="flex items-center bg-white border border-gray-300 shadow-sm rounded-xl">
                      <button onClick={goPrevWeek} className="p-2 hover:bg-gray-50 rounded-l-xl">
                        <ChevronLeft size={16} />
                      </button>
                      <button onClick={goNextWeek} className="p-2 hover:bg-gray-50 rounded-r-xl">
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    {lessons.length === 0 ? (
                      <EmptyState icon={Calendar} title="Занятий не запланировано" />
                    ) : (
                      <Card className="overflow-hidden">
                        <WeekView
                          cursor={weekCursor}
                          lessons={lessons}
                          students={profile ? [profile] : []}
                          onDayClick={() => {}}
                          onLessonClick={(l) => {
                            if (l.status === "cancelled") {
                              showToast("Занятие отменено");
                              return;
                            }
                            if (!isLessonPast(l)) {
                              setOpenUpcoming(l);
                              return;
                            }
                            setOpenDetail({ lesson: l, homework: homework.find((h) => h.lessonId === l.id), initialTab: "info" });
                          }}
                        />
                      </Card>
                    )}
                  </div>
                  <div className="hidden lg:block w-72 shrink-0">
                    <MiniCalendar
                      selected={weekCursor}
                      highlightDates={new Set(lessons.map((l) => l.date))}
                      onSelect={setWeekCursor}
                    />
                  </div>
                </div>
              </div>
            )}

            {tab === "messages" && <MessagesTab code={code} messages={messages} setMessages={setMessages} showToast={showToast} />}

            {tab === "homework" && (
              <HomeworkTabContent
                homework={homework}
                lessons={lessons}
                notes={notes}
                onOpen={(lesson, h) => setOpenDetail({ lesson: lesson || undefined, homework: h, initialTab: "homework" })}
              />
            )}
          </>
        )}
      </main>

      {openDetail && (
        <LessonDetailModal
          code={code}
          lesson={openDetail.lesson}
          homework={openDetail.homework}
          note={
            openDetail.homework?.noteId
              ? notes.find((n) => n.id === openDetail.homework!.noteId)
              : openDetail.lesson?.noteId
                ? notes.find((n) => n.id === openDetail.lesson!.noteId)
                : undefined
          }
          initialTab={openDetail.initialTab}
          onSubmitHomework={submitHomework}
          onClose={() => setOpenDetail(null)}
        />
      )}

      {openUpcoming && (
        <Modal title={`Урок · ${fmtDateRu(openUpcoming.date)}`} onClose={() => setOpenUpcoming(null)}>
          <div className="space-y-4">
            <div className="text-sm text-gray-700">
              {openUpcoming.time} · {durationLabel(openUpcoming.duration)}
            </div>
            {openUpcoming.cancelRequested ? (
              <div className="px-3.5 py-3 rounded-xl bg-amber-50 text-amber-700 text-sm">
                Запрос на отмену отправлен, ждём подтверждения от преподавателя.
              </div>
            ) : (
              <GhostButton
                full
                danger
                onClick={() => window.confirm("Запросить отмену этого занятия?") && requestCancel(openUpcoming.id)}
              >
                Запросить отмену занятия
              </GhostButton>
            )}
          </div>
        </Modal>
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-[#111827] text-white text-sm px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-400" />
          {toast}
        </div>
      )}
    </div>
  );
}

const DETAIL_TAB_META: Record<DetailTab, { label: string }> = {
  record: { label: "Запись урока" },
  info: { label: "Информация об уроке" },
  homework: { label: "ДЗ" },
};

function LessonDetailModal({
  code,
  lesson,
  homework,
  note,
  initialTab,
  onSubmitHomework,
  onClose,
}: {
  code: string;
  lesson?: Lesson;
  homework?: Homework;
  note?: MethodNote;
  initialTab: DetailTab;
  onSubmitHomework: (id: string, attachments: Attachment[]) => void;
  onClose: () => void;
}) {
  const tabs: DetailTab[] = [
    ...(lesson ? (["record", "info"] as DetailTab[]) : []),
    ...(homework ? (["homework"] as DetailTab[]) : []),
  ];
  const [tab, setTab] = useState<DetailTab>(tabs.includes(initialTab) ? initialTab : tabs[0]);

  const title = homework?.title || (lesson ? `Урок · ${fmtDateRu(lesson.date)}` : "Занятие");

  return (
    <Modal title={title} onClose={onClose} full>
      {tabs.length > 1 && (
        <div className="flex gap-1 mb-4 border-b border-[#F0F1F4] overflow-x-auto -mt-1">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3.5 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition ${
                tab === t ? "border-[#2563EB] text-[#2563EB]" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {DETAIL_TAB_META[t].label}
            </button>
          ))}
        </div>
      )}

      {tab === "record" && lesson && <RecordTab lesson={lesson} />}
      {tab === "info" && lesson && <InfoTab lesson={lesson} note={note} />}
      {tab === "homework" && homework && <HomeworkTab code={code} homework={homework} onSubmit={onSubmitHomework} onClose={onClose} />}
    </Modal>
  );
}

function RecordTab({ lesson }: { lesson: Lesson }) {
  if (!lesson.attachments || lesson.attachments.length === 0) {
    return <div className="py-14 text-center text-gray-400 text-sm">Преподаватель ещё не прикрепил запись урока</div>;
  }
  return <LargeAttachmentList attachments={lesson.attachments} />;
}

function InfoTab({ lesson, note }: { lesson: Lesson; note?: MethodNote }) {
  const tasks = note?.tabs?.tasks?.trim();
  const tasksAttachments = note?.attachments?.tasks ?? [];
  const theory = note?.tabs?.theory?.trim();
  const theoryAttachments = note?.attachments?.theory ?? [];
  const rules = note?.tabs?.rules?.trim();
  const rulesAttachments = note?.attachments?.rules ?? [];
  const nothing = !lesson.comment && !lesson.nextPlan && !note;

  if (nothing) {
    return <div className="py-14 text-center text-gray-400 text-sm">Преподаватель пока не заполнил информацию об уроке</div>;
  }

  return (
    <div className="space-y-4">
      {lesson.comment && (
        <div className="px-3.5 py-3 rounded-xl bg-gray-50 border border-gray-200">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Комментарий преподавателя</div>
          <div className="text-sm text-gray-700 whitespace-pre-wrap">{lesson.comment}</div>
        </div>
      )}

      {lesson.nextPlan && (
        <div className="px-3.5 py-3 rounded-xl bg-blue-50">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[#2563EB] mb-1">План на следующий урок</div>
          <div className="text-sm text-gray-700 whitespace-pre-wrap">{lesson.nextPlan}</div>
        </div>
      )}

      {note && (
        <div>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 mb-2">
            <Layers size={15} className="text-gray-400" /> {note.topic}
          </div>
          <div className="space-y-3">
            {(tasks || tasksAttachments.length > 0) && (
              <div className="px-3.5 py-3 rounded-xl bg-[#F7F8FA] border border-[#E7E9EE]">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Задания</div>
                {tasks && <div className="text-sm text-gray-700 whitespace-pre-wrap mb-2">{tasks}</div>}
                {tasksAttachments.length > 0 && <AttachmentList attachments={tasksAttachments} />}
              </div>
            )}
            {(theory || theoryAttachments.length > 0) && (
              <div className="px-3.5 py-3 rounded-xl bg-emerald-50 border border-emerald-100">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 mb-1">Теория</div>
                {theory && <div className="text-sm text-gray-700 whitespace-pre-wrap mb-2">{theory}</div>}
                {theoryAttachments.length > 0 && <AttachmentList attachments={theoryAttachments} />}
              </div>
            )}
            {(rules || rulesAttachments.length > 0) && (
              <div className="px-3.5 py-3 rounded-xl bg-amber-50 border border-amber-100">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 mb-1">Правила</div>
                {rules && <div className="text-sm text-gray-700 whitespace-pre-wrap mb-2">{rules}</div>}
                {rulesAttachments.length > 0 && <AttachmentList attachments={rulesAttachments} />}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function HomeworkTab({
  code,
  homework,
  onSubmit,
  onClose,
}: {
  code: string;
  homework: Homework;
  onSubmit: (id: string, attachments: Attachment[]) => void;
  onClose: () => void;
}) {
  const status = normalizeHomeworkStatus(homework.status);
  const [submissionFiles, setSubmissionFiles] = useState<Attachment[]>(homework.submissionAttachments || []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${HW_STATUS_META[status].color}`}>{HW_STATUS_META[status].label}</span>
        <span className="text-xs text-gray-500">{homework.due ? `срок до ${fmtDateRu(homework.due)}` : "без срока"}</span>
        {homework.grade != null && (
          <span className="w-7 h-7 flex items-center justify-center rounded-full bg-[#EEF2FF] text-[#2563EB] text-sm font-bold">{homework.grade}</span>
        )}
      </div>

      <div className="text-sm text-gray-800 whitespace-pre-wrap">{homework.title}</div>

      {homework.attachments && homework.attachments.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Файлы задания</div>
          <AttachmentList attachments={homework.attachments} />
        </div>
      )}

      {homework.reviewComment && (
        <div className="px-3.5 py-3 rounded-xl bg-blue-50">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[#2563EB] mb-1">Комментарий преподавателя</div>
          <div className="text-sm text-gray-700 whitespace-pre-wrap">{homework.reviewComment}</div>
        </div>
      )}

      {status === "assigned" ? (
        <div className="border-t border-[#F0F1F4] pt-4 space-y-3">
          <AttachmentsField
            attachments={submissionFiles}
            onChange={setSubmissionFiles}
            label="Прикрепите фото или файл с выполненным заданием"
            folder={`portal-${code}`}
          />
          <PrimaryButton
            full
            icon={Check}
            disabled={submissionFiles.length === 0}
            onClick={() => {
              onSubmit(homework.id, submissionFiles);
              onClose();
            }}
          >
            Сдать
          </PrimaryButton>
          {submissionFiles.length === 0 && (
            <div className="text-xs text-gray-400 text-center">Чтобы сдать, сначала прикрепите хотя бы один файл</div>
          )}
        </div>
      ) : (
        submissionFiles.length > 0 && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Ваш ответ</div>
            <AttachmentList attachments={submissionFiles} />
          </div>
        )
      )}
    </div>
  );
}

function MessagesTab({
  code,
  messages,
  setMessages,
  showToast,
}: {
  code: string;
  messages: ChatMessage[];
  setMessages: (m: ChatMessage[]) => void;
  showToast: (t: string) => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<Attachment[]>([]);
  const [showAttach, setShowAttach] = useState(false);

  async function send() {
    const value = text.trim();
    if ((!value && pendingFiles.length === 0) || sending) return;
    setSending(true);
    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`,
      from: "student",
      text: value,
      at: Date.now(),
      attachments: pendingFiles.length ? pendingFiles : undefined,
    };
    setMessages([...messages, optimistic]);
    setText("");
    const files = pendingFiles;
    setPendingFiles([]);
    setShowAttach(false);
    try {
      await sendStudentMessage(code, value, files);
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
          <div key={m.id} className={`max-w-[75%] ${m.from === "student" ? "ml-auto" : ""}`}>
            {m.text && (
              <div className={`px-3.5 py-2 rounded-2xl text-sm ${m.from === "student" ? "bg-[#2563EB] text-white rounded-br-sm" : "bg-gray-100 rounded-bl-sm"}`}>
                {m.text}
              </div>
            )}
            {m.attachments && m.attachments.length > 0 && (
              <div className={`${m.text ? "mt-1.5" : ""} ${m.from === "student" ? "flex justify-end" : ""}`}>
                <AttachmentList attachments={m.attachments} />
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-[#F0F1F4] space-y-2">
        {showAttach && (
          <AttachmentsField attachments={pendingFiles} onChange={setPendingFiles} label="Прикрепить к сообщению" folder={`portal-${code}`} />
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowAttach((s) => !s)}
            className={`shrink-0 p-2.5 rounded-xl border transition ${showAttach || pendingFiles.length > 0 ? "bg-blue-50 border-blue-200 text-[#2563EB]" : "bg-white border-[#E7E9EE] text-gray-400 hover:text-gray-600"}`}
            title="Прикрепить файл"
          >
            <Paperclip size={17} />
          </button>
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
      </div>
    </Card>
  );
}
