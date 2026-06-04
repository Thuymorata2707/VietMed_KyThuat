import { ChevronRight } from 'lucide-react';
import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import './styles.css';

type AdminShortcutProps = {
  to: string;
  icon: ReactNode;
  title: string;
  detail: string;
};

export function AdminShortcut({ to, icon, title, detail }: AdminShortcutProps) {
  return (
    <Link className="admin-shortcut" to={to}>
      <div className="metric-icon">{icon}</div>
      <div>
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
      <ChevronRight size={18} />
    </Link>
  );
}
