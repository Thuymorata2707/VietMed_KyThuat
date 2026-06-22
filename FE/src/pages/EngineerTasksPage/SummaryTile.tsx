import type { TaskTone } from './types';

export function SummaryTile({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: TaskTone }) {
  const toneClass =
    tone === 'danger'
      ? 'border-[#fecdd3] bg-[#fff1f3] text-[#a3342b]'
      : 'border-[#d9e1ea] bg-white text-[#142033]';

  return (
    <article className={`grid min-h-[86px] min-w-0 gap-2 overflow-hidden rounded-lg border p-4 shadow-[0_1px_2px_rgba(20,32,51,0.04)] ${toneClass}`}>
      <span className="text-[13px] font-medium text-[#657386]">{label}</span>
      <strong className="text-[28px] leading-none">{value}</strong>
    </article>
  );
}
