import { useState } from "react";
import { Plus, Trash2, UsersRound } from "lucide-react";
import { Avatar, Card, EmptyState, Field, Modal, PageHeader, PrimaryButton, TextInput } from "../components/ui";
import { uid } from "../lib/utils";
import type { Group, Student } from "../lib/types";

interface Props {
  groups: Group[];
  setGroups: (g: Group[]) => void;
  students: Student[];
  showToast: (t: string) => void;
}

export function GroupsView({ groups, setGroups, students, showToast }: Props) {
  const [showAdd, setShowAdd] = useState(false);

  function addGroup(name: string, memberIds: string[]) {
    setGroups([{ id: uid(), name, memberIds }, ...groups]);
    setShowAdd(false);
    showToast(`Группа «${name}» создана`);
  }

  function removeGroup(id: string) {
    setGroups(groups.filter((g) => g.id !== id));
    showToast("Группа удалена");
  }

  return (
    <div>
      <PageHeader
        title="Группы"
        subtitle="Объединяйте учеников в группы для совместных занятий"
        right={
          <PrimaryButton icon={Plus} onClick={() => setShowAdd(true)}>
            Создать группу
          </PrimaryButton>
        }
      />

      {groups.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="Групп пока нет"
          subtitle="Создайте первую группу, чтобы вести групповые занятия"
          action={
            <PrimaryButton icon={Plus} onClick={() => setShowAdd(true)}>
              Создать группу
            </PrimaryButton>
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((g) => (
            <Card key={g.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold">{g.name}</div>
                <button onClick={() => removeGroup(g.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500">
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="flex -space-x-2 mb-2">
                {g.memberIds.slice(0, 6).map((mid) => {
                  const st = students.find((s) => s.id === mid);
                  return st ? (
                    <div key={mid} className="ring-2 ring-white rounded-full">
                      <Avatar id={st.id} name={st.name} size={32} color={st.color} />
                    </div>
                  ) : null;
                })}
              </div>
              <div className="text-xs text-gray-500">{g.memberIds.length} {g.memberIds.length === 1 ? "участник" : "участников"}</div>
            </Card>
          ))}
        </div>
      )}

      {showAdd && <AddGroupModal students={students} onClose={() => setShowAdd(false)} onSave={addGroup} />}
    </div>
  );
}

function AddGroupModal({
  students,
  onClose,
  onSave,
}: {
  students: Student[];
  onClose: () => void;
  onSave: (name: string, memberIds: string[]) => void;
}) {
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<string[]>([]);

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim(), picked);
  }

  return (
    <Modal title="Новая группа" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Название группы">
          <TextInput required value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, ЕГЭ Математика 11" />
        </Field>
        <Field label="Участники">
          {students.length === 0 ? (
            <div className="text-sm text-gray-400 py-2">Сначала добавьте учеников</div>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1 border border-[#E7E9EE] rounded-xl p-2">
              {students.map((s) => (
                <label key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer text-sm">
                  <input type="checkbox" checked={picked.includes(s.id)} onChange={() => toggle(s.id)} className="accent-[#2563EB]" />
                  {s.name}
                </label>
              ))}
            </div>
          )}
        </Field>
        <PrimaryButton type="submit" full>
          Создать группу
        </PrimaryButton>
      </form>
    </Modal>
  );
}
