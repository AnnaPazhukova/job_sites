import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { dateKey, MONTHS_RU, TODAY, WEEKDAYS_RU } from "../lib/utils";

interface Props {
  /** The day to highlight as selected/current. */
  selected: Date;
  /** dateKey()-formatted dates that have at least one lesson — shown with a small dot. */
  highlightDates: Set<string>;
  onSelect: (d: Date) => void;
}

// A small month-grid navigator, independent from the main calendar's own
// prev/next paging — browsing to a different month here doesn't move the
// main view until a specific day is actually clicked. It resyncs to the
// selected day's month whenever that changes elsewhere (e.g. the main
// "Сегодня" button or prev/next week arrows).
export function MiniCalendar({ selected, highlightDates, onSelect }: Props) {
  const [monthCursor, setMonthCursor] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));

  useEffect(() => {
    setMonthCursor(new Date(selected.getFullYear(), selected.getMonth(), 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected.getFullYear(), selected.getMonth()]);

  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();

  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev = new Date(year, month, 0).getDate();
    const arr: { day: number; current: boolean; date: Date }[] = [];
    for (let i = startOffset - 1; i >= 0; i--) arr.push({ day: daysInPrev - i, current: false, date: new Date(year, month - 1, daysInPrev - i) });
    for (let d = 1; d <= daysInMonth; d++) arr.push({ day: d, current: true, date: new Date(year, month, d) });
    while (arr.length % 7 !== 0) {
      const d = arr.length - (startOffset + daysInMonth) + 1;
      arr.push({ day: d, current: false, date: new Date(year, month + 1, d) });
    }
    return arr;
  }, [year, month]);

  const selectedKey = dateKey(selected);
  const todayKey = dateKey(TODAY);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setMonthCursor(new Date(year, month - 1, 1))} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <ChevronLeft size={16} />
        </button>
        <div className="text-sm font-semibold">
          {MONTHS_RU[month]} {year}
        </div>
        <button onClick={() => setMonthCursor(new Date(year, month + 1, 1))} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center">
        {WEEKDAYS_RU.map((d) => (
          <div key={d} className="text-[10px] font-semibold text-gray-400 pb-1.5">
            {d}
          </div>
        ))}
        {cells.map((c, i) => {
          const key = dateKey(c.date);
          const isSelected = key === selectedKey;
          const isToday = key === todayKey;
          const hasLessons = highlightDates.has(key);
          return (
            <button
              key={i}
              onClick={() => onSelect(c.date)}
              className="relative py-0.5"
              title={c.date.toLocaleDateString("ru-RU")}
            >
              <span
                className={`w-7 h-7 mx-auto flex items-center justify-center rounded-full text-xs transition ${
                  !c.current
                    ? "text-gray-300 hover:bg-gray-50"
                    : isSelected
                      ? "bg-[#2563EB] text-white font-semibold"
                      : isToday
                        ? "text-[#2563EB] font-semibold hover:bg-blue-50"
                        : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {c.day}
              </span>
              {hasLessons && c.current && !isSelected && (
                <span className="absolute left-1/2 -translate-x-1/2 bottom-0 w-1 h-1 rounded-full bg-[#2563EB]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
