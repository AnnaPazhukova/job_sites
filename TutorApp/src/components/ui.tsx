import React, { type ReactNode } from "react";
import { X, type LucideIcon } from "lucide-react";
import { colorFor, initials, LESSON_DURATIONS, type RecurrenceEnd, type RecurrenceFreq } from "../lib/utils";

export function Card({
  children,
  className = "",
  style,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}) {
  if (onClick) {
    return (
      <div
        style={style}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        className={`bg-white rounded-2xl border border-[#E7E9EE] shadow-sm ${className}`}
      >
        {children}
      </div>
    );
  }
  return (
    <div style={style} className={`bg-white rounded-2xl border border-[#E7E9EE] shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="text-gray-500 text-sm mt-1">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center justify-center text-center py-20 px-6">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4 text-gray-400">
        <Icon size={28} strokeWidth={1.6} />
      </div>
      <div className="font-semibold text-lg">{title}</div>
      {subtitle && <div className="text-gray-500 text-sm mt-1 max-w-sm">{subtitle}</div>}
      {action && <div className="mt-5">{action}</div>}
    </Card>
  );
}

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  icon?: LucideIcon;
  type?: "button" | "submit";
  full?: boolean;
  disabled?: boolean;
}

export function PrimaryButton({ children, onClick, icon: Icon, type = "button", full, disabled }: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${full ? "w-full" : ""} inline-flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-4 py-2.5 rounded-xl transition text-sm`}
    >
      {Icon && <Icon size={17} />}
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  icon: Icon,
  danger,
  full,
  type = "button",
  disabled,
}: ButtonProps & { danger?: boolean }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${full ? "flex-1" : ""} inline-flex items-center justify-center gap-2 font-medium px-3.5 py-2.5 rounded-xl transition text-sm border shadow-sm disabled:opacity-40 disabled:cursor-not-allowed
      ${danger ? "bg-white border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400" : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400"}`}
    >
      {Icon && <Icon size={15} />}
      {children}
    </button>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

type TextInputProps = React.InputHTMLAttributes<HTMLInputElement> & { icon?: LucideIcon };

export function TextInput({ icon: Icon, className = "", ...props }: TextInputProps) {
  return (
    <div className="relative">
      {Icon && <Icon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />}
      <input
        {...props}
        className={`w-full ${Icon ? "pl-10" : "pl-3.5"} pr-3.5 py-2.5 rounded-xl bg-[#F7F8FA] border border-[#E7E9EE] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] text-sm placeholder:text-gray-400 disabled:opacity-60 ${className}`}
      />
    </div>
  );
}

type TextAreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export function TextArea({ className = "", ...props }: TextAreaProps) {
  return (
    <textarea
      {...props}
      className={`w-full px-3.5 py-2.5 rounded-xl bg-[#F7F8FA] border border-[#E7E9EE] text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] resize-none placeholder:text-gray-400 ${className}`}
    />
  );
}

export function Select({
  value,
  onChange,
  options,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full px-3.5 py-2.5 rounded-xl bg-[#F7F8FA] border border-[#E7E9EE] text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] ${className}`}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className={`bg-white w-full ${wide ? "sm:max-w-lg" : "sm:max-w-md"} rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E7E9EE] sticky top-0 bg-white z-10">
          <h3 className="font-bold text-lg">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={20} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Avatar({ id, name, size = 40 }: { id: string; name: string; size?: number }) {
  const bg = colorFor(id);
  return (
    <div
      style={{ width: size, height: size, background: bg }}
      className="rounded-full flex items-center justify-center text-white font-semibold shrink-0"
    >
      <span style={{ fontSize: size * 0.38 }}>{initials(name)}</span>
    </div>
  );
}

export function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`w-10 h-6 rounded-full transition relative ${checked ? "bg-[#2563EB]" : "bg-gray-200"}`}
      >
        <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full transition" style={{ left: checked ? 18 : 2 }} />
      </button>
    </div>
  );
}

const PILL_TONES: Record<string, string> = {
  default: "bg-gray-100 text-gray-600",
  level: "bg-emerald-50 text-emerald-700",
  type: "bg-blue-50 text-[#2563EB]",
};

export function Pill({ children, tone = "default" }: { children: ReactNode; tone?: keyof typeof PILL_TONES }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] tracking-wide uppercase font-semibold ${PILL_TONES[tone]}`}>
      {children}
    </span>
  );
}

const RECURRENCE_DAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function RecurrenceFields({
  recurring,
  setRecurring,
  freq,
  setFreq,
  days,
  toggleDay,
  endType,
  setEndType,
  count,
  setCount,
  untilDate,
  setUntilDate,
}: {
  recurring: boolean;
  setRecurring: (v: boolean) => void;
  freq: RecurrenceFreq;
  setFreq: (v: RecurrenceFreq) => void;
  days: number[];
  toggleDay: (d: number) => void;
  endType: RecurrenceEnd;
  setEndType: (v: RecurrenceEnd) => void;
  count: number;
  setCount: (v: number) => void;
  untilDate: string;
  setUntilDate: (v: string) => void;
}) {
  return (
    <div className="border border-[#E7E9EE] rounded-xl p-4">
      <div className="flex items-center justify-between mb-1">
        <div>
          <div className="font-medium text-sm">Регулярные занятия</div>
          <div className="text-xs text-gray-500">Создать серию по расписанию</div>
        </div>
        <button
          type="button"
          onClick={() => setRecurring(!recurring)}
          className={`w-10 h-6 rounded-full transition relative shrink-0 ${recurring ? "bg-[#2563EB]" : "bg-gray-200"}`}
        >
          <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full transition" style={{ left: recurring ? 18 : 2 }} />
        </button>
      </div>

      {recurring && (
        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["daily", "Ежедневно"],
                ["weekly", "Еженедельно"],
                ["monthly", "Ежемесячно"],
              ] as const
            ).map(([v, l]) => (
              <button
                key={v}
                type="button"
                onClick={() => setFreq(v)}
                className={`py-2 rounded-xl text-sm font-medium border transition ${freq === v ? "bg-[#2563EB] text-white border-[#2563EB]" : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400"}`}
              >
                {l}
              </button>
            ))}
          </div>

          {freq === "weekly" && (
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">Дни повторения</div>
              <div className="grid grid-cols-7 gap-1.5">
                {RECURRENCE_DAY_LABELS.map((l, i) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={`py-2 rounded-xl text-xs font-medium border transition ${days.includes(i) ? "bg-[#2563EB] text-white border-[#2563EB]" : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400"}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="text-sm font-medium text-gray-700 mb-2">Окончание серии</div>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["count", "Количество"],
                  ["until", "До даты"],
                  ["endless", "Бессрочно"],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setEndType(v)}
                  className={`py-2 rounded-xl text-sm font-medium border transition ${endType === v ? "bg-[#2563EB] text-white border-[#2563EB]" : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400"}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {endType === "count" && (
            <Field label="Количество занятий">
              <TextInput type="number" value={count} onChange={(e) => setCount(Number(e.target.value) || 1)} />
            </Field>
          )}
          {endType === "until" && (
            <Field label="Дата окончания">
              <TextInput type="date" value={untilDate} onChange={(e) => setUntilDate(e.target.value)} />
            </Field>
          )}
        </div>
      )}
    </div>
  );
}

export function DurationPicker({ value, onChange }: { value: number; onChange: (minutes: number) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {LESSON_DURATIONS.map((d) => (
        <button
          key={d.minutes}
          type="button"
          onClick={() => onChange(d.minutes)}
          className={`py-2.5 rounded-xl text-sm font-medium border transition ${
            value === d.minutes ? "bg-[#2563EB] text-white border-[#2563EB]" : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400"
          }`}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}
