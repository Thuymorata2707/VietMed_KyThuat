import { CalendarDays } from 'lucide-react';

type DateInputProps = {
  className?: string;
  disabled?: boolean;
  label?: string;
  onChange: (value: string) => void;
  required?: boolean;
  value: string;
};

export function DateInput({ className = '', disabled, label, onChange, required, value }: DateInputProps) {
  return (
    <span className={`grid min-w-0 gap-2 text-sm font-semibold text-[#334155] ${className}`}>
      {label ? <span>{label}</span> : null}
      <span className="group flex h-12 min-w-0 items-center gap-2 rounded-2xl border border-[#cbd5e1] bg-white px-3 text-[#172033] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition focus-within:border-[#2563eb] focus-within:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]">
        <CalendarDays className="shrink-0 text-[#64748b] transition group-focus-within:text-[#2563eb]" size={17} />
        <input
          className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm font-semibold text-[#172033] outline-none [color-scheme:light] disabled:cursor-not-allowed disabled:text-[#94a3b8]"
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          type="date"
          value={value}
        />
      </span>
    </span>
  );
}
