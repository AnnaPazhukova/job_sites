import { useState } from "react";
import { Calendar as CalendarIcon, Mail, Phone, Plus, School, Search, Settings as SettingsIcon, Star, Target, Trash2, User, UsersRound, Wallet } from "lucide-react";
import { Avatar, Card, DurationPicker, EmptyState, Field, Modal, PageHeader, PrimaryButton, Select, TextInput } from "../components/ui";
import { durationLabel, fmtMoney, GRADES, TODAY_KEY, uid } from "../lib/utils";
import type { Group, Lesson, Student } from "../lib/types";

// Positive balance = prepaid credit (paid lessons still in the future).
// Negative balance = debt (past/today lessons that were never marked paid).
export function studentBalance(lessons: Lesson[], studentId: string) {
  const own = lessons.filter((l) => l.studentId === studentId && l.status !== "cancelled");
  const advance = own
    .filter((l) => l.paymentStatus === "paid" && l.date > TODAY_KEY)
    .reduce((s, l) => s + (Number(l.price) || 0), 0);
  const debt = own
    .filter((l) => l.paymentStatus !== "paid" && l.date <= TODAY_KEY)
    .reduce((s, l) => s + (Number(l.price) || 0), 0);
  return advance - debt;
}

interface Props {
  students: Student[];
  setStudents: (s: Student[]) => void;
  groups: Group[];
  lessons: Lesson[];
  setView: (v: "students" | "student-detail") => void;
  showToast: (t: string) => void;
  setSelectedStudentId: (id: string) => void;
}

export function StudentsView({ students, setStudents, lessons, setView, showToast, setSelectedStudentId }: Props) {
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const filtered = students.filter(
    (s) =>
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      (s.email || "").toLowerCase().includes(query.toLowerCase())
  );

  function addStudent(data: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    rate: number;
    duration: number;
    birthDate: string;
    grade: string;
    school: string;
    goal: string;
  }) {
    const name = `${data.firstName} ${data.lastName}`.trim();
    const student: Student = {
      id: uid(),
      favorite: false,
      color: null,
      note: "",
      subscription: null,
      joinedAt: TODAY_KEY,
      ...data,
      name,
    };
    setStudents([student, ...students]);
    setShowAdd(false);
    showToast(`Ученик «${name}» добавлен`);
  }

  function removeStudent(id: string) {
    setStudents(students.filter((s) => s.id !== id));
    showToast("Ученик удалён");
  }

  function openStudent(id: string) {
    setSelectedStudentId(id);
    setView("student-detail");
  }

  return (
    <div>
      <PageHeader
        title="Мои ученики"
        right={
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по имени, email..."
                className="pl-10 pr-3.5 py-2.5 rounded-xl bg-white border border-gray-300 shadow-sm text-sm w-56 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
              />
            </div>
            <PrimaryButton icon={Plus} onClick={() => setShowAdd(true)}>
              Добавить
            </PrimaryButton>
          </div>
        }
      />

      {students.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="У вас пока нет учеников"
          subtitle="Добавьте первого ученика, чтобы начать работу"
          action={
            <PrimaryButton icon={Plus} onClick={() => setShowAdd(true)}>
              Добавить ученика
            </PrimaryButton>
          }
        />
      ) : filtered.length === 0 ? (
        <Card className="py-16 text-center text-gray-500">Ничего не найдено по запросу «{query}»</Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => {
            const balance = studentBalance(lessons, s.id);
            return (
              <Card key={s.id} className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                <div onClick={() => openStudent(s.id)} className="flex items-start gap-3">
                  <Avatar id={s.id} name={s.name} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate flex items-center gap-1.5">
                      {s.name}
                      {s.favorite && <Star size={13} className="fill-amber-400 text-amber-400 shrink-0" />}
                    </div>
                    <div className="text-xs text-gray-500 truncate">{durationLabel(s.duration)}</div>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-lg shrink-0
                    ${balance > 0 ? "bg-emerald-50 text-emerald-600" : balance < 0 ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-500"}`}
                  >
                    {balance === 0 ? "0 ₽" : `${balance > 0 ? "+" : ""}${fmtMoney(balance)}`}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#F0F1F4] text-xs text-gray-500">
                  <span>{s.phone || "Телефон не указан"}</span>
                  <div className="flex gap-1">
                    <button onClick={() => openStudent(s.id)} className="p-1.5 rounded-lg hover:bg-gray-100">
                      <SettingsIcon size={15} />
                    </button>
                    <button onClick={() => removeStudent(s.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {showAdd && <AddStudentModal onClose={() => setShowAdd(false)} onSave={addStudent} />}
    </div>
  );
}

function AddStudentModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (data: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    rate: number;
    duration: number;
    birthDate: string;
    grade: string;
    school: string;
    goal: string;
  }) => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [rate, setRate] = useState("");
  const [duration, setDuration] = useState(60);
  const [birthDate, setBirthDate] = useState("");
  const [grade, setGrade] = useState(GRADES[2]);
  const [school, setSchool] = useState("");
  const [goal, setGoal] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() && !lastName.trim()) return;
    onSave({ firstName: firstName.trim(), lastName: lastName.trim(), phone, email, rate: Number(rate) || 0, duration, birthDate, grade, school, goal });
  }

  return (
    <Modal title="Новый ученик" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Имя">
            <TextInput icon={User} required value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Иван" />
          </Field>
          <Field label="Фамилия">
            <TextInput value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Петров" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Дата рождения">
            <TextInput icon={CalendarIcon} type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          </Field>
          <Field label="Стоимость занятия, ₽">
            <TextInput icon={Wallet} type="number" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="1500" />
          </Field>
        </div>
        <Field label="Время проведения урока">
          <DurationPicker value={duration} onChange={setDuration} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Телефон">
            <TextInput icon={Phone} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7..." />
          </Field>
          <Field label="E-mail">
            <TextInput icon={Mail} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="student@mail.ru" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Класс">
            <Select value={grade} onChange={setGrade} options={GRADES} />
          </Field>
          <Field label="Учебное заведение">
            <TextInput icon={School} value={school} onChange={(e) => setSchool(e.target.value)} placeholder="Лицей №9" />
          </Field>
        </div>
        <Field label="Цель занятий">
          <TextInput icon={Target} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Сдать ЕГЭ на 90+ баллов" />
        </Field>
        <PrimaryButton type="submit" full>
          Добавить ученика
        </PrimaryButton>
      </form>
    </Modal>
  );
}
