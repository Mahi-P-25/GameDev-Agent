import type { ReactNode } from 'react';
import { cn } from '../../design/cn';

interface SectionProps {
  children: ReactNode;
  id?: string;
  className?: string;
}

export function Section({ children, id, className }: SectionProps) {
  return (
    <section id={id} className={cn('relative px-6 py-32 sm:py-40', className)}>
      <div className="mx-auto max-w-7xl">{children}</div>
    </section>
  );
}
