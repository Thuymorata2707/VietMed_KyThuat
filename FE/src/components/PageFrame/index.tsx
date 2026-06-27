import { ReactNode } from 'react';

export function PageFrame({ children }: { children: ReactNode }) {
  return <section className="mx-auto grid min-w-0 w-full max-w-[1480px] gap-6 px-7 py-7 font-sans max-sm:gap-5 max-sm:px-4 max-sm:py-5 [&>*]:min-w-0">{children}</section>;
}
