import { ChevronRight } from 'lucide-react';
import { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type AdminShortcutProps = {
  to: string;
  icon: ReactNode;
  title: string;
  detail: string;
};

export function AdminShortcut({ to, icon, title, detail }: AdminShortcutProps) {
  return (
    <Link className="group grid min-h-24 grid-cols-[40px_minmax(0,1fr)_18px] items-center gap-3 rounded-lg border border-[#e5e5e5] bg-white p-4 shadow-[0_1px_2px_rgba(20,32,51,0.05)] transition hover:-translate-y-px hover:border-[#b7e4dd] hover:bg-[#ffffff] hover:shadow-[0_12px_30px_rgba(20,32,51,0.08)]" to={to}>
      <div className="metric-icon">{icon}</div>
      <div>
        <strong className="block text-sm text-[#1f1f1f]">{title}</strong>
        <span className="mt-1 block text-[13px] leading-snug text-[#666666]">{detail}</span>
      </div>
      <ChevronRight className="text-[#666666] transition group-hover:translate-x-0.5 group-hover:text-[#0f766e]" size={18} />
    </Link>
  );
}
