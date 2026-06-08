import type { TaskTone } from './types';

export function SummaryTile({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: TaskTone }) {
  return (
    <article className={`summary-tile ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
