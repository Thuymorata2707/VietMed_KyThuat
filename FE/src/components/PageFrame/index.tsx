import { ReactNode } from 'react';
import './styles.css';

export function PageFrame({ children }: { children: ReactNode }) {
  return <section className="page-frame">{children}</section>;
}
