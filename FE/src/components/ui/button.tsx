import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex min-h-9 shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border text-sm font-medium outline-none transition-[background-color,border-color,color,box-shadow,transform] hover:-translate-y-px focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:pointer-events-none disabled:cursor-wait disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary px-4 text-primary-foreground shadow-xs hover:bg-primary/90',
        secondary: 'border-transparent bg-secondary px-4 text-secondary-foreground shadow-xs hover:bg-secondary/80',
        destructive: 'border-transparent bg-destructive px-4 text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/30',
        outline: 'border-input bg-background px-4 shadow-xs hover:bg-accent hover:text-accent-foreground',
        ghost: 'border-transparent bg-transparent px-4 text-foreground hover:bg-accent hover:text-accent-foreground',
        link: 'min-h-0 border-transparent bg-transparent px-0 text-primary underline-offset-4 hover:translate-y-0 hover:underline',
        icon: 'h-9 min-h-9 w-9 border-input bg-background p-0 text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        default: '',
        sm: 'min-h-8 rounded-md px-3 text-xs',
        lg: 'min-h-10 rounded-md px-6',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export function Button({ asChild = false, className, size, variant, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button';

  return <Comp className={cn(buttonVariants({ className, size, variant }))} {...props} />;
}

export { buttonVariants };
