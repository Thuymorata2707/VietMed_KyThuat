import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border text-sm font-medium transition-[background-color,border-color,color,box-shadow,transform] disabled:pointer-events-none disabled:cursor-wait disabled:opacity-70 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-[#d71920] px-[13px] text-white shadow-[0_1px_2px_rgba(181,18,27,0.22)] hover:-translate-y-px hover:bg-[#b5121b]',
        secondary: 'border-[#e5e5e5] bg-white px-[13px] text-[#333333] shadow-[0_1px_2px_rgba(20,32,51,0.05)] hover:-translate-y-px hover:border-[#f5c7cb] hover:bg-[#fff5f5] hover:text-[#d71920]',
        destructive: 'border-transparent bg-[#b5121b] px-[13px] text-white hover:-translate-y-px',
        ghost: 'border-transparent bg-transparent px-[13px] text-[#333333] hover:bg-[#fff5f5] hover:text-[#d71920]',
        icon: 'h-[34px] min-h-[34px] w-[34px] border-[#e5e5e5] bg-white p-0 text-[#333333] shadow-[0_1px_2px_rgba(20,32,51,0.05)] hover:-translate-y-px hover:border-[#f5c7cb] hover:bg-[#fff5f5] hover:text-[#d71920]',
      },
      size: {
        default: '',
        sm: 'min-h-9 px-3 text-xs',
        lg: 'min-h-11 px-4',
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
