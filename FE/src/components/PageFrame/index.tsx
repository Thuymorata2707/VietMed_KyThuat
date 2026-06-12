import { ReactNode } from 'react';

export function PageFrame({ children }: { children: ReactNode }) {
  return <section className="mx-auto grid w-full max-w-[1480px] gap-[18px] px-6 py-[22px] font-sans max-sm:px-4 max-sm:py-5">{children}</section>;
}
