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
      ? 'summary-tile--danger'
      : tone === 'warn'
        ? 'summary-tile--warn'
      : 'summary-tile--neutral';
  const className = [
    'summary-tile',
    toneClass,
    onClick ? 'summary-tile--interactive' : '',
    active ? 'summary-tile--active' : '',
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
