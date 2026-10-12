import { CircleHelp } from 'lucide-react';
import { useId } from 'react';

type InfoHintProps = {
  label: string;
  content: string;
};

export function InfoHint({ label, content }: InfoHintProps) {
  const tooltipId = useId();

  return (
    <button
      aria-describedby={tooltipId}
      aria-label={`Thông tin: ${label}`}
      className="group relative inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[#667085] transition-colors hover:bg-[#eef2f6] hover:text-[#344054] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
      title={content}
      type="button"
    >
      <CircleHelp aria-hidden="true" size={15} />
      <span
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-64 -translate-x-1/2 rounded-lg border border-[#dbe2ea] bg-white px-3 py-2 text-left text-xs font-medium leading-5 text-[#344054] opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        id={tooltipId}
        role="tooltip"
      >
        {content}
      </span>
    </button>
  );
}
