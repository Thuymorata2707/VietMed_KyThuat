import type { TaskTone } from './types';

export function SummaryTile({
  active,
  description,
  label,
  onClick,
  tone = 'neutral',
  value,
}: {
  active?: boolean;
  description?: string;
  label: string;
  onClick?: () => void;
  tone?: TaskTone;
  value: number;
}) {
  const toneClass =
    tone === 'danger'
      ? 'border-[#fecdd3] bg-[#fff1f3] text-[#b5121b]'
      : tone === 'warn'
        ? 'border-[#efd8a8] bg-[#fffaeb] text-[#9b5a17]'
      : 'border-[#e5e5e5] bg-white text-[#1f1f1f]';
  const className = [
    'grid min-h-[104px] min-w-0 gap-2 overflow-hidden rounded-lg border p-4 text-left shadow-[0_1px_2px_rgba(20,32,51,0.04)] transition',
    toneClass,
    onClick ? 'hover:-translate-y-[1px] hover:border-[#0f766e] hover:shadow-[0_10px_28px_rgba(20,32,51,0.08)]' : '',
    active ? 'ring-2 ring-[#0f766e]/15' : '',
  ].join(' ');
  const content = (
    <>
      <span className="text-[13px] font-medium text-[#666666]">{label}</span>
      <strong className="text-[28px] leading-none">{value}</strong>
      {description ? <span className="text-xs leading-5 text-[#666666]">{description}</span> : null}
    </>
  );

  if (onClick) {
    return (
      <button className={className} onClick={onClick} type="button">
        {content}
      </button>
    );
  }

  return <article className={className}>{content}</article>;
}
