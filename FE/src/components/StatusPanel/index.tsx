import { Activity } from 'lucide-react';

type StatusPanelProps = {
  title: string;
  items: Array<[string, number | undefined]>;
};

export function StatusPanel({ title, items }: StatusPanelProps) {
  return (
    <article className="rounded-lg border border-[#e3eaf2] bg-white p-[18px] shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:-translate-y-px hover:border-[#d7e0eb] hover:shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
      <div className="flex items-center gap-2.5">
        <Activity className="text-[#c92a1f]" size={19} />
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
      <div className="mt-[18px] grid gap-2.5">
        {items.map(([label, value]) => (
          <div className="flex min-h-12 items-center justify-between rounded-lg border border-[#e5ebf2] bg-white px-[13px] transition hover:border-[#d7e0eb] hover:bg-[#fbfdff]" key={label}>
            <span className="text-[13px] font-medium text-[#657384]">{label}</span>
            <strong className="inline-flex min-h-7 min-w-[34px] items-center justify-center rounded-full border border-[#f0b7b1] bg-[#fff1ef] px-2.5 py-1.5 text-[13px] font-bold text-[#c92a1f]">{value ?? '-'}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}
