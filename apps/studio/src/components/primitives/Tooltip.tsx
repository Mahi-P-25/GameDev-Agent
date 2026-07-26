import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { motion } from 'motion/react';
import { forwardRef } from 'react';
import type { ReactNode } from 'react';
import { cn } from '../../design/cn';
import { useNovaMotion } from '../../design/motion';

export const TooltipProvider = TooltipPrimitive.Provider;

export interface TooltipProps {
  readonly content: ReactNode;
  readonly children: ReactNode;
  readonly side?: 'top' | 'right' | 'bottom' | 'left';
  readonly delay?: number;
}

/**
 * Tooltip — accessible hover/focus tooltip built on Radix (manages positioning,
 * collision, and a11y). Animated with Nova's surface preset and respects
 * reduced motion via useNovaMotion.
 */
export function Tooltip({ content, children, side = 'top', delay = 200 }: TooltipProps): ReactNode {
  const presets = useNovaMotion();
  return (
    <TooltipPrimitive.Root delayDuration={delay}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content asChild side={side} sideOffset={8} className="z-50">
          <motion.div
            className={cn(
              'glass-strong rounded-md px-2.5 py-1.5 text-xs font-medium text-fg',
              'max-w-xs select-none',
            )}
            {...presets.surface}
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-[color-mix(in_srgb,var(--color-bg-elevated)_82%,transparent)]" />
          </motion.div>
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

/** Standalone wrapper so a single provider can wrap the app once. */
export const TooltipRoot = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;
export const TooltipContent = forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(function TooltipContent({ className, ...props }, ref) {
  return (
    <TooltipPrimitive.Content
      ref={ref}
      className={cn('glass-strong rounded-md px-2.5 py-1.5 text-xs text-fg', className)}
      {...props}
    />
  );
});
