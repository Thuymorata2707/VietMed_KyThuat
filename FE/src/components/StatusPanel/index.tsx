import { Activity } from 'lucide-react';

type StatusPanelProps = {
  title: string;
  items: Array<[string, number | undefined]>;
};

export function StatusPanel({ title, items }: StatusPanelProps) {
  return (
    <article className="rounded-lg border border-[#e5e5e5] bg-white p-[18px] shadow-[0_1px_2px_rgba(24,24,27,0.04)] transition hover:-translate-y-px hover:border-[#d7e0eb] hover:shadow-[0_12px_30px_rgba(24,24,27,0.06)]">
      <div className="flex items-center gap-2.5">
        <Activity className="text-[#18181b]" size={19} />
        <h2 className="text-lg font-medium">{title}</h2>
      </div>
      <div className="mt-[18px] grid gap-2.5">
        {items.map(([label, value]) => (
          <div className="flex min-h-12 items-center justify-between rounded-lg border border-[#e5ebf2] bg-white px-[13px] transition hover:border-[#d7e0eb] hover:bg-[#fafafa]" key={label}>
            <span className="text-[13px] font-medium text-[#666666]">{label}</span>
            <strong className="inline-flex min-h-7 min-w-[34px] items-center justify-center rounded-full border border-[#e4e4e7] bg-[#f4f4f5] px-2.5 py-1.5 text-[13px] font-medium text-[#18181b]">{value ?? '-'}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}
