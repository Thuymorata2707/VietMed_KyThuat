import { ReactNode } from 'react';

export function PageFrame({ children }: { children: ReactNode }) {
  return <section className="mx-auto grid min-w-0 w-full max-w-[1540px] gap-5 px-6 py-6 font-sans max-sm:px-4 max-sm:py-5 [&>*]:min-w-0">{children}</section>;
}
