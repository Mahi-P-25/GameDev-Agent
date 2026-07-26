import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { motion } from 'motion/react';
import { forwardRef } from 'react';
import type { ReactNode } from 'react';
import { cn } from '../../design/cn';
import { useNovaMotion } from '../../design/motion';

export interface ModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title?: ReactNode;
  readonly description?: ReactNode;
  readonly children?: ReactNode;
  readonly footer?: ReactNode;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly className?: string;
}

const SIZE = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
} as const;

/**
 * Modal — an accessible dialog built on Radix Dialog (focus trap, scroll lock,
 * ESC to close) with Nova's surface enter/exit animation. Use for confirmations
 * and focused tasks, never for content that belongs on a page.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
  className,
}: ModalProps): ReactNode {
  const presets = useNovaMotion();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay asChild>
          <motion.div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            {...presets.overlay}
          />
        </Dialog.Overlay>
        <Dialog.Content asChild>
          <motion.div
            className={cn(
              'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2',
              'rounded-lg border border-border-strong bg-bg-panel shadow-lg',
              'flex flex-col max-h-[88vh]',
              SIZE[size],
              className,
            )}
            {...presets.surface}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div className="min-w-0">
                {title !== undefined && (
                  <Dialog.Title className="text-base font-semibold text-fg">{title}</Dialog.Title>
                )}
                {description !== undefined && (
                  <Dialog.Description className="mt-1 text-[13px] text-fg-subtle">
                    {description}
                  </Dialog.Description>
                )}
              </div>
              <Dialog.Close
                className="rounded-md p-1 text-fg-subtle transition-colors hover:bg-bg-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                aria-label="Close"
              >
                <X className="size-4" />
              </Dialog.Close>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
            {footer !== undefined && (
              <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3.5">
                {footer}
              </div>
            )}
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Convenience sub-components for modal composition. */
export const ModalBody = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function ModalBody({ className, ...props }, ref) {
    return <div ref={ref} className={cn('px-5 py-4', className)} {...props} />;
  },
);
