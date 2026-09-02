import { AlertCircle, BookOpen, Calendar as CalendarIcon, ChevronRight, CheckCircle2, Clock, Layers, TrendingUp, UsersRound, Wallet, type LucideIcon } from "lucide-react";
import { Card, PageHeader } from "../components/ui";
import { fmtMoney, isLessonPast, paidAmountOf, paymentStateOf, remainingAmountOf, sumPrice, TODAY, TODAY_KEY, dateKey } from "../lib/utils";
import type { Homework, Lesson, MethodNote, Student, Task, ViewId } from "../lib/types";

interface Props {
  lessons: Lesson[];
  students: Student[];
  homework: Homework[];
  tasks: Task[];
  notes: MethodNote[];
  setView: (v: ViewId) => void;
}

export function StatsView({ lessons, students, homework, tasks, notes, setView }: Props) {
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(TODAY);
    d.setDate(d.getDate() - 13 + i);
    return d;
  });

  const activeLessons = lessons.filter((l) => l.status !== "cancelled");

  const income = days.map((d) => {
    const key = dateKey(d);
    return activeLessons.filter((l) => l.date === key).reduce((s, l) => s + paidAmountOf(l), 0);
  });

  const growth = days.map((d) => {
    const key = dateKey(d);
    return students.filter((s) => s.joinedAt && s.joinedAt <= key).length;
  });

  // isLessonPast (end-of-lesson time), not just the calendar date, so a
  // lesson later today isn't already counted as received/owed before it's
  // even happened.
  const pastLessons = activeLessons.filter((l) => isLessonPast(l));
  const futureLessons = activeLessons.filter((l) => !isLessonPast(l));
  const paidPast = pastLessons.reduce((s, l) => s + paidAmountOf(l), 0);
  const paidAdvance = futureLessons.reduce((s, l) => s + paidAmountOf(l), 0);
  const debt = pastLessons.reduce((s, l) => s + remainingAmountOf(l), 0);
  const monthEnd = dateKey(new Date(TODAY.getFullYear(), TODAY.getMonth() + 1, 0));
  const monthForecast = sumPrice(activeLessons.filter((l) => l.date > TODAY_KEY && l.date <= monthEnd));

  const currentMonthPrefix = TODAY_KEY.slice(0, 7);
  const monthLessons = activeLessons.filter((l) => l.date.slice(0, 7) === currentMonthPrefix);
  const workedHours = monthLessons.filter((l) => l.date <= TODAY_KEY).reduce((s, l) => s + (Number(l.duration) || 0), 0) / 60;
  const scheduledHours = monthLessons.filter((l) => l.date > TODAY_KEY).reduce((s, l) => s + (Number(l.duration) || 0), 0) / 60;

  const pendingHomework = homework.filter((h) => h.status !== "done").length;
  const missed = activeLessons.filter((l) => paymentStateOf(l) !== "paid" && l.date < TODAY_KEY).length;

  return (
    <div>
      <PageHeader title="Статистика" />
      <div className="mb-1 text-lg font-bold">Обзор показателей</div>
      <div className="text-sm text-gray-500 mb-5">Анализ вашей деятельности на сегодняшний день</div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard color="emerald" icon={CheckCircle2} label="Оплаченные занятия" sub="Получено по факту" value={fmtMoney(paidPast)} onClick={() => setView("schedule")} />
        <StatCard color="teal" icon={Wallet} label="Оплачено вперёд" sub="Авансовые платежи" value={fmtMoney(paidAdvance)} onClick={() => setView("schedule")} />
        <StatCard color="rose" icon={AlertCircle} label="Ожидает оплаты" sub="Дебиторская задолженность" value={fmtMoney(debt)} onClick={() => setView("schedule")} />
        <StatCard color="blue" icon={TrendingUp} label="До конца месяца" sub="Прогноз дохода" value={fmtMoney(monthForecast)} onClick={() => setView("schedule")} />
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4 min-w-0">
        <div className="space-y-4 min-w-0">
          <Card className="p-5">
            <div className="font-semibold flex items-center gap-2 mb-4">
              <TrendingUp size={17} className="text-[#2563EB]" /> Динамика доходов <span className="text-xs text-gray-400 font-normal ml-1">за 14 дней</span>
            </div>
            <MiniChart data={income} color="#2563EB" />
          </Card>
          <Card className="p-5">
            <div className="font-semibold flex items-center gap-2 mb-4">
              <UsersRound size={17} className="text-emerald-500" /> Рост ученической базы
            </div>
            <MiniChart data={growth} color="#059669" />
          </Card>
          <Card className="p-5">
            <div className="font-semibold flex items-center gap-2 mb-4">
              <Layers size={17} className="text-purple-500" /> Учебные материалы
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#F7F8FA] rounded-xl px-3.5 py-3">
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                  <BookOpen size={15} className="text-[#8C3B2E]" /> Задач в базе
                </div>
                <div className="text-2xl font-extrabold">{tasks.length}</div>
              </div>
              <button
                onClick={() => setView("notes")}
                className="bg-[#F7F8FA] rounded-xl px-3.5 py-3 text-left hover:bg-[#F0F1F4] transition"
              >
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                  <Layers size={15} className="text-[#2F5B4E]" /> Тем методики
                </div>
                <div className="text-2xl font-extrabold">{notes.length}</div>
              </button>
            </div>
          </Card>
        </div>
        <div className="space-y-4">
          <Card className="p-5">
            <div className="font-semibold flex items-center gap-2 mb-4">
              <Clock size={17} className="text-indigo-500" /> Рабочее время <span className="text-xs text-gray-400 font-normal ml-1">в этом месяце</span>
            </div>
            <div className="flex items-center justify-between bg-[#F7F8FA] rounded-xl px-3.5 py-2.5 mb-2">
              <span className="flex items-center gap-2 text-sm">
                <CheckCircle2 size={15} className="text-emerald-500" /> Отработано
              </span>
              <span className="font-semibold text-sm">{workedHours.toFixed(1)} ч</span>
            </div>
            <div className="flex items-center justify-between bg-[#F7F8FA] rounded-xl px-3.5 py-2.5">
              <span className="flex items-center gap-2 text-sm">
                <Clock size={15} className="text-blue-500" /> В графике
              </span>
              <span className="font-semibold text-sm">{scheduledHours.toFixed(1)} ч</span>
            </div>
          </Card>
          <Card onClick={() => setView("homework")} className="p-5 cursor-pointer hover:shadow-md hover:border-gray-300 transition">
            <div className="font-semibold flex items-center gap-2 mb-3">
              <BookOpen size={17} className="text-red-500" /> Домашние задания
              <ChevronRight size={15} className="text-gray-300 ml-auto" />
            </div>
            <div className="text-xs text-gray-500 mb-1">Несделанных работ</div>
            <div className="text-3xl font-extrabold text-red-600 mb-3">{pendingHomework}</div>
            {pendingHomework > 0 ? (
              <div className="text-xs bg-red-50 text-red-600 px-3 py-2 rounded-xl">Ученики ждут вашей проверки или напоминания о сроках.</div>
            ) : (
              <div className="text-xs bg-emerald-50 text-emerald-600 px-3 py-2 rounded-xl">Все работы проверены</div>
            )}
          </Card>
          <Card onClick={() => setView("schedule")} className="p-5 cursor-pointer hover:shadow-md hover:border-gray-300 transition">
            <div className="font-semibold flex items-center gap-2 mb-3">
              <CalendarIcon size={17} className="text-amber-500" /> Прошедшие неоплаченные
              <ChevronRight size={15} className="text-gray-300 ml-auto" />
            </div>
            <div className="text-xs text-gray-500 mb-3">Занятия в прошлом без отметки об оплате. Всего: {missed}</div>
            {missed === 0 ? (
              <div className="border-2 border-dashed border-emerald-200 rounded-xl py-6 text-center">
                <CheckCircle2 size={22} className="text-emerald-500 mx-auto mb-1" />
                <div className="text-sm font-medium text-emerald-600">Задолженностей нет</div>
              </div>
            ) : (
              <div className="text-2xl font-bold text-amber-600">{missed}</div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

const STAT_COLORS: Record<string, string> = {
  emerald: "bg-emerald-50 text-emerald-600",
  teal: "bg-teal-50 text-teal-600",
  rose: "bg-rose-50 text-rose-600",
  blue: "bg-blue-50 text-blue-600",
};

function StatCard({
  color,
  icon: Icon,
  label,
  sub,
  value,
  onClick,
}: {
  color: string;
  icon: LucideIcon;
  label: string;
  sub: string;
  value: string;
  onClick?: () => void;
}) {
  const [bg, text] = STAT_COLORS[color].split(" ");
  return (
    <Card
      onClick={onClick}
      className={`p-4 sm:p-5 ${bg} border-0 ${onClick ? "cursor-pointer hover:shadow-md hover:brightness-[0.98] transition text-left" : ""}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
          <Icon size={16} className={text} />
        </div>
        <span className={`text-[11px] font-bold uppercase tracking-wide ${text}`}>{label}</span>
      </div>
      <div className="text-[11px] uppercase text-gray-500 font-medium">{sub}</div>
      <div className="text-2xl font-extrabold mt-0.5">{value}</div>
    </Card>
  );
}

function MiniChart({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  const w = 600,
    h = 160,
    pad = 8;
  const pts = data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (w - pad * 2);
      const y = h - pad - (v / max) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");
  const allZero = data.every((v) => v === 0);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      {[0, 1, 2, 3].map((i) => (
        <line key={i} x1={0} x2={w} y1={pad + (i * (h - pad * 2)) / 3} y2={pad + (i * (h - pad * 2)) / 3} stroke="#F0F1F4" strokeDasharray="4 4" />
      ))}
      {!allZero && <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}
