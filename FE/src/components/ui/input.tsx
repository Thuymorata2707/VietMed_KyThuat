import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.ComponentProps<'input'>;

export function Input({ className, type, ...props }: InputProps) {
  return (
    <input
      className={cn(
        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      type={type}
      {...props}
    />
  );
}
