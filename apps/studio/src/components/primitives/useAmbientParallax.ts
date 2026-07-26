import { useEffect, useRef, useState } from 'react';

/**
 * A single, subtle parallax for the ambient layer — the only depth cue that
 * responds to the pointer. It moves the background light a few pixels opposite
 * the cursor so the studio reads as a room with depth, never a sliding UI.
 *
 * Truthful and quiet: it only transforms a non-interactive, behind-everything
 * layer; readable content never moves. Disabled entirely under
 * `prefers-reduced-motion`.
 */
export function useAmbientParallax(maxShift = 10): React.CSSProperties {
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    const onMove = (event: PointerEvent): void => {
      if (frame.current !== null) return;
      frame.current = window.requestAnimationFrame(() => {
        frame.current = null;
        const nx = (event.clientX / window.innerWidth - 0.5) * 2;
        const ny = (event.clientY / window.innerHeight - 0.5) * 2;
        setOffset({ x: -nx * maxShift, y: -ny * maxShift });
      });
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    };
  }, [maxShift]);

  return {
    transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
  };
}
