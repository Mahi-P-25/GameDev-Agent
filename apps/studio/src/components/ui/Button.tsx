import { Slot } from '@radix-ui/react-slot';
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../design/cn';
import { type Intent, buttonVariants } from '../../design/variants';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger' | 'outline';
  readonly size?: 'sm' | 'md' | 'lg' | 'icon';
  readonly intent?: Intent;
  readonly leftIcon?: ReactNode;
  readonly rightIcon?: ReactNode;
  /** Render as the child element (Radix Slot) instead of a <button>. */
  readonly asChild?: boolean;
}

/**
 * Button — Nova's primary action primitive.
 * Variants carry intent; `asChild` lets it wrap a router Link while keeping
 * the styling contract.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = 'secondary',
    size = 'md',
    intent,
    leftIcon,
    rightIcon,
    asChild,
    children,
    ...props
  },
  ref,
) {
  const Comp = asChild ? Slot : 'button';
  void intent;
  return (
    <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props}>
      {leftIcon !== undefined && <span className="shrink-0">{leftIcon}</span>}
      {children}
      {rightIcon !== undefined && <span className="shrink-0">{rightIcon}</span>}
    </Comp>
  );
});
