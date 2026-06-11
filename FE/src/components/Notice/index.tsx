import { AlertTriangle } from 'lucide-react';

export function Notice({ message }: { message: string }) {
  return (
    <div className="flex min-h-11 items-center gap-2.5 rounded-lg border border-[#fed7aa] bg-[#fff7ed] px-3.5 text-[#9a3412]">
      <AlertTriangle size={18} />
      <span>{message}</span>
    </div>
  );
}
