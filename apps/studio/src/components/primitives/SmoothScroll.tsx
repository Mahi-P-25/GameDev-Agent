import Lenis from 'lenis';
import { useReducedMotion } from 'motion/react';
import { useEffect } from 'react';

/**
 * SmoothScroll — optional Lenis-powered inertial scrolling for the cinematic
 * feel. Disabled entirely under `prefers-reduced-motion`. Mount once near the
 * app root. Respects the user's motion preference — no scroll hijacking when
 * reduced motion is requested.
 */
export function SmoothScroll(): null {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) return;
    const lenis = new Lenis({
      duration: 0.9,
      easing: (t) => 1 - (1 - t) ** 3,
      smoothWheel: true,
    });

    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, [reduce]);

  return null;
}
