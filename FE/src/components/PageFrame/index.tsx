import { ReactNode } from 'react';

export function PageFrame({ children }: { children: ReactNode }) {
  return <section className="mx-auto grid min-w-0 w-full max-w-full gap-[18px] px-6 py-[22px] font-sans min-[1680px]:max-w-[1480px] max-sm:px-4 max-sm:py-5 [&>*]:min-w-0">{children}</section>;
}
