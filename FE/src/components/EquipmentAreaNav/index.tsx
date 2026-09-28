import { Boxes, Layers3, Wrench } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

type EquipmentArea = 'catalog' | 'inventory' | 'machines';

const links: Array<{ area: EquipmentArea; href: string; label: string; icon: typeof Boxes }> = [
  { area: 'catalog', href: '/product-catalog', label: 'Danh mục thiết bị', icon: Layers3 },
  { area: 'inventory', href: '/inventory-movements', label: 'Kho máy', icon: Boxes },
  { area: 'machines', href: '/technical-machines', label: 'Hồ sơ máy', icon: Wrench },
];

export function EquipmentAreaNav({ active }: { active: EquipmentArea }) {
  const location = useLocation();

  return (
    <nav aria-label="Danh mục thiết bị" className="flex w-full gap-1 overflow-x-auto rounded-2xl border border-[#e4e4e7] bg-[#f5f6f7] p-1.5 sm:w-fit">
      {links.map(({ area, href, label, icon: Icon }) => {
        const selected = area === active;
        const target = area === 'inventory' && active === 'inventory'
          ? `${href}${location.search}`
          : href;

        return (
          <Link
            aria-current={selected ? 'page' : undefined}
            className={`inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#344054] ${selected ? 'bg-white text-[#202124] shadow-[0_1px_3px_rgba(24,24,27,0.12)]' : 'text-[#667085] hover:bg-white/70 hover:text-[#344054]'}`}
            key={area}
            to={target}
          >
            <Icon aria-hidden="true" size={16} strokeWidth={1.9} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
