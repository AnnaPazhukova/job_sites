import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card, Field, GhostButton, Modal, PrimaryButton, TextInput } from "../components/ui";
import { WEEKDAYS_RU, uid } from "../lib/utils";
import type { Group, Student, WeeklyTemplateSlot } from "../lib/types";

interface WhoOption {
  id: string;
  name: string;
  type: "student" | "group";
  rate: number;
  duration: number;
}

interface Props {
  slots: WeeklyTemplateSlot[];
  setSlots: (s: WeeklyTemplateSlot[]) => void;
  students: Student[];
  groups: Group[];
  onClose: () => void;
  onApply: () => void;
}

export function WeeklyTemplateModal({ slots, setSlots, students, groups, onClose, onApply }: Props) {
  const options: WhoOption[] = [
    ...students.map((s) => ({ id: s.id, name: s.name, type: "student" as const, rate: s.rate || 0, duration: s.duration || 60 })),
    ...groups.map((g) => ({ id: g.id, name: g.name, type: "group" as const, rate: 0, duration: 60 })),
  ];
  const [adding, setAdding] = useState(false);

  function removeSlot(id: string) {
    setSlots(slots.filter((s) => s.id !== id));
  }

  function addSlot(data: Omit<WeeklyTemplateSlot, "id">) {
    setSlots([...slots, { id: uid(), ...data }]);
    setAdding(false);
  }

  return (
    <Modal title="Шаблон недели" onClose={onClose} wide>
      <p className="text-sm text-gray-500 mb-4">
        Повторяющиеся занятия по дням недели. Кнопка «Заполнить эту неделю» создаст занятия из шаблона для текущей недели, не дублируя уже существующие.
      </p>

      <div className="space-y-1 mb-4 max-h-64 overflow-y-auto">
        {WEEKDAYS_RU.map((label, weekday) => {
          const daySlots = slots.filter((s) => s.weekday === weekday);
          if (daySlots.length === 0) return null;
          return (
            <div key={weekday}>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 pt-2 pb-1">{label}</div>
              {daySlots.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 text-sm">
                  <span>
                    {s.time} · {s.title} · {s.duration} мин
                  </span>
                  <button onClick={() => removeSlot(s.id)} className="p-1 rounded hover:bg-red-50 text-red-500 shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          );
        })}
        {slots.length === 0 && <div className="text-sm text-gray-400 py-4 text-center">Шаблон пуст</div>}
      </div>

      {adding ? (
        <AddSlotForm options={options} onCancel={() => setAdding(false)} onSave={addSlot} />
      ) : (
        <GhostButton full icon={Plus} onClick={() => setAdding(true)}>
          Добавить слот
        </GhostButton>
      )}

      <div className="flex gap-2 pt-4">
        <GhostButton full onClick={onClose}>
          Закрыть
        </GhostButton>
        <PrimaryButton full onClick={onApply}>
          Заполнить эту неделю
        </PrimaryButton>
      </div>
    </Modal>
  );
}

function AddSlotForm({
  options,
  onCancel,
  onSave,
}: {
  options: WhoOption[];
  onCancel: () => void;
  onSave: (d: Omit<WeeklyTemplateSlot, "id">) => void;
}) {
  const [weekday, setWeekday] = useState(0);
  const [who, setWho] = useState(options[0]?.id || "");
  const [time, setTime] = useState("15:00");
  const [duration, setDuration] = useState(options[0]?.duration || 60);
  const [price, setPrice] = useState(options[0]?.rate || 0);

  function selectWho(id: string) {
    setWho(id);
    const opt = options.find((o) => o.id === id);
    if (opt) {
      setDuration(opt.duration);
      setPrice(opt.rate);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const target = options.find((o) => o.id === who);
    if (!target) return;
    onSave({
      weekday,
      time,
      duration: Number(duration),
      price: Number(price),
      studentId: target.type === "student" ? target.id : undefined,
      groupId: target.type === "group" ? target.id : undefined,
      title: target.name,
    });
  }

  return (
    <Card className="p-3 mb-3">
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="День недели">
            <select
              value={weekday}
              onChange={(e) => setWeekday(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F8FA] border border-[#E7E9EE] text-sm"
            >
              {WEEKDAYS_RU.map((l, i) => (
                <option key={i} value={i}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Время">
            <TextInput type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>
        {options.length > 0 ? (
          <Field label="Ученик или группа">
            <select value={who} onChange={(e) => selectWho(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F8FA] border border-[#E7E9EE] text-sm">
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} {o.type === "group" ? "(группа)" : ""}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <div className="text-sm text-gray-400">Сначала добавьте ученика или группу</div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Длительность, мин">
            <TextInput type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
          </Field>
          <Field label="Стоимость, ₽">
            <TextInput type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
          </Field>
        </div>
        <div className="flex gap-2">
          <GhostButton full onClick={onCancel}>
            Отмена
          </GhostButton>
          <PrimaryButton type="submit" full disabled={options.length === 0}>
            Добавить
          </PrimaryButton>
        </div>
      </form>
    </Card>
  );
}
