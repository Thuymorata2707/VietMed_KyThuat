import { Activity } from 'lucide-react';
import './styles.css';

type StatusPanelProps = {
  title: string;
  items: Array<[string, number | undefined]>;
};

export function StatusPanel({ title, items }: StatusPanelProps) {
  return (
    <article className="status-panel">
      <div className="panel-heading">
        <Activity size={19} />
        <h2>{title}</h2>
      </div>
      <div className="status-list">
        {items.map(([label, value]) => (
          <div className="status-row" key={label}>
            <span>{label}</span>
            <strong>{value ?? '-'}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}
