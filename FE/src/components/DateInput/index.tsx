import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

type DateInputProps = {
  className?: string;
  disabled?: boolean;
  label?: string;
  onChange: (value: string) => void;
  required?: boolean;
  value: string;
};

const weekdays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const months = Array.from({ length: 12 }, (_, index) => ({
  label: `Tháng ${index + 1}`,
  value: index,
}));
const years = Array.from({ length: 101 }, (_, index) => 1970 + index);

export function DateInput({ className = '', disabled, label, onChange, required, value }: DateInputProps) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => dateFromInput(value) ?? new Date());
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const selectedDate = dateFromInput(value);

  useEffect(() => {
    const nextDate = dateFromInput(value);
    if (nextDate) setViewDate(nextDate);
  }, [value]);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: MouseEvent) {
      if (wrapperRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }

    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [open]);

  const calendarDays = useMemo(() => buildCalendarDays(viewDate), [viewDate]);

  function selectDate(date: Date) {
    onChange(toDateInput(date));
    setOpen(false);
  }

  function updateViewDate(patch: { month?: number; year?: number }) {
    setViewDate((current) => new Date(patch.year ?? current.getFullYear(), patch.month ?? current.getMonth(), 1));
  }

  return (
    <span className={`relative grid min-w-0 gap-2 text-sm font-semibold text-[#334155] ${className}`} ref={wrapperRef}>
      {label ? <span>{label}</span> : null}
      <button
        className="group flex h-11 min-w-0 items-center gap-2 rounded-xl border border-[#cbd5e1] bg-white px-3 text-left text-[#172033] transition hover:border-[#93c5fd] focus:border-[#2563eb] focus:outline-none focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)] disabled:cursor-not-allowed disabled:bg-[#f1f5f9] disabled:text-[#94a3b8]"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <CalendarDays className="shrink-0 text-[#64748b] transition group-focus:text-[#2563eb]" size={17} />
        <span className={`min-w-0 flex-1 truncate text-sm font-semibold ${value ? 'text-[#172033]' : 'text-[#94a3b8]'}`}>
          {selectedDate ? formatDisplayDate(selectedDate) : 'Chọn ngày'}
        </span>
        {required && !value ? <input className="pointer-events-none absolute h-px w-px opacity-0" required value="" onChange={() => null} /> : null}
      </button>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+8px)] z-[90] w-[310px] overflow-hidden rounded-[22px] border border-[#dbe6f3] bg-white shadow-[0_24px_54px_rgba(15,23,42,0.18)]">
          <div className="flex items-center justify-between border-b border-[#e2e8f0] bg-[#f8fbff] px-3 py-3">
            <button className="grid size-9 place-items-center rounded-xl text-[#475569] transition hover:bg-white hover:text-[#172033]" onClick={() => setViewDate(addMonths(viewDate, -1))} type="button">
              <ChevronLeft size={17} />
            </button>
            <div className="grid grid-cols-[118px_92px] gap-2">
              <select
                className="h-9 rounded-xl border border-[#dbe6f3] bg-white px-2 text-xs font-bold text-[#172033] outline-none transition focus:border-[#2563eb] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)]"
                onChange={(event) => updateViewDate({ month: Number(event.target.value) })}
                value={viewDate.getMonth()}
              >
                {months.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
              <select
                className="h-9 rounded-xl border border-[#dbe6f3] bg-white px-2 text-xs font-bold text-[#172033] outline-none transition focus:border-[#2563eb] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)]"
                onChange={(event) => updateViewDate({ year: Number(event.target.value) })}
                value={viewDate.getFullYear()}
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            <button className="grid size-9 place-items-center rounded-xl text-[#475569] transition hover:bg-white hover:text-[#172033]" onClick={() => setViewDate(addMonths(viewDate, 1))} type="button">
              <ChevronRight size={17} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 px-3 pt-3 text-center text-[11px] font-bold uppercase tracking-[0.08em] text-[#94a3b8]">
            {weekdays.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 p-3">
            {calendarDays.map((day) => {
              const active = value === toDateInput(day.date);
              const today = isSameDate(day.date, new Date());
              return (
                <button
                  className={[
                    'grid h-9 place-items-center rounded-xl text-sm font-semibold transition',
                    day.inMonth ? 'text-[#172033]' : 'text-[#cbd5e1]',
                    active ? 'bg-[#2563eb] text-white shadow-[0_10px_22px_rgba(37,99,235,0.24)]' : '',
                    !active && today ? 'bg-[#eff6ff] text-[#1d4ed8]' : '',
                    !active && !today ? 'hover:bg-[#f1f5f9]' : '',
                  ].filter(Boolean).join(' ')}
                  key={day.key}
                  onClick={() => selectDate(day.date)}
                  type="button"
                >
                  {day.date.getDate()}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between border-t border-[#e2e8f0] bg-[#fbfdff] px-3 py-2">
            <button className="rounded-xl px-3 py-2 text-xs font-bold text-[#64748b] transition hover:bg-white hover:text-[#172033]" onClick={() => onChange('')} type="button">
              Xóa
            </button>
            <button className="rounded-xl px-3 py-2 text-xs font-bold text-[#2563eb] transition hover:bg-[#eff6ff]" onClick={() => selectDate(new Date())} type="button">
              Hôm nay
            </button>
          </div>
        </div>
      ) : null}
    </span>
  );
}

function buildCalendarDays(value: Date) {
  const firstDay = new Date(value.getFullYear(), value.getMonth(), 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date,
      inMonth: date.getMonth() === value.getMonth(),
      key: toDateInput(date),
    };
  });
}

function addMonths(value: Date, count: number) {
  return new Date(value.getFullYear(), value.getMonth() + count, 1);
}

function dateFromInput(value: string) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDisplayDate(value: Date) {
  return value.toLocaleDateString('vi-VN');
}

function isSameDate(first: Date, second: Date) {
  return first.toDateString() === second.toDateString();
}

function toDateInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
