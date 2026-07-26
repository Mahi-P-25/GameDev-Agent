import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { CommandCenterModule } from '../../modules/command-center/CommandCenterModule';
import { useCommandCenter } from '../../modules/command-center/CommandCenterModule';
import { ToastViewport } from '../ui/ToastViewport';

/**
 * GlobalOverlays — app-wide floating surfaces mounted once in the shared page
 * chrome: the Nova Command Center (⌘K / Ctrl+K) and the toast viewport. Keeps
 * global UI out of individual pages.
 */
export function GlobalOverlays(): ReactNode {
  const controller = useCommandCenter();

  // Global Ctrl/Cmd+K listener toggles the Command Center from anywhere.
  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        controller.toggle();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [controller]);

  return (
    <>
      <CommandCenterModule />
      <ToastViewport />
    </>
  );
}
