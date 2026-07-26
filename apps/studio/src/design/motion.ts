import { useReducedMotion } from 'motion/react';

/**
 * Nova Motion System
 * ------------------
 * Every animation in Nova flows through these tokens. Motion is a *signal*, not
 * decoration: it communicates spatial relationships, state changes, and focus.
 * Rules (from the sprint charter):
 *   - Every animation must improve usability.
 *   - Honor `prefers-reduced-motion` — degrade to instant, never remove content.
 *   - Prefer transform/opacity (compositor-friendly) over layout/paint.
 */

export const motionTokens = {
  duration: {
    instant: 0.08,
    fast: 0.14,
    base: 0.2,
    slow: 0.32,
    slower: 0.48,
  },
  /** Standard easing curves, expressed for Motion (cubic-bezier tuples). */
  ease: {
    standard: [0.2, 0, 0, 1],
    out: [0.16, 1, 0.3, 1],
    in: [0.4, 0, 1, 1],
    spring: [0.16, 1, 0.3, 1],
  },
} as const;

/** Shared variant presets for `motion` components. */
export const motionPresets = {
  /** Content fades + lifts in. Used for cards, panels, route enters. */
  fadeUp: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -4 },
    transition: { duration: motionTokens.duration.base, ease: motionTokens.ease.out },
  },
  /** Fade + drop from above — headings, banners. */
  fadeDown: {
    initial: { opacity: 0, y: -8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -4 },
    transition: { duration: motionTokens.duration.base, ease: motionTokens.ease.out },
  },
  /** Blur + fade reveal — glass surfaces, hero media. */
  blurReveal: {
    initial: { opacity: 0, y: 12, filter: 'blur(8px)' },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
    exit: { opacity: 0, y: 6, filter: 'blur(6px)' },
    transition: { duration: motionTokens.duration.slow, ease: motionTokens.ease.out },
  },
  /** Soft fade only — for overlays, toasts, inline swaps. */
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: motionTokens.duration.fast, ease: motionTokens.ease.standard },
  },
  /** Modal / command palette: backdrop fades, surface scales up from 96%. */
  overlay: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: motionTokens.duration.fast, ease: motionTokens.ease.standard },
  },
  surface: {
    initial: { opacity: 0, scale: 0.96, y: 8 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.98, y: 4 },
    transition: { duration: motionTokens.duration.base, ease: motionTokens.ease.out },
  },
  /** Full page transition — used by the Shell route wrapper. */
  pageTransition: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -6 },
    transition: { duration: motionTokens.duration.slow, ease: motionTokens.ease.out },
  },
  /** Card reveal — slightly stronger lift than fadeUp. */
  cardReveal: {
    initial: { opacity: 0, y: 16, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -8, scale: 0.99 },
    transition: { duration: motionTokens.duration.slow, ease: motionTokens.ease.out },
  },
  /** Hero reveal — grand entrance for landing surfaces. */
  heroReveal: {
    initial: { opacity: 0, y: 24, filter: 'blur(10px)' },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
    exit: { opacity: 0, y: -12, filter: 'blur(8px)' },
    transition: { duration: motionTokens.duration.slower, ease: motionTokens.ease.out },
  },
  /** Hover lift — for interactive cards/buttons. */
  hoverLift: {
    initial: { y: 0 },
    whileHover: { y: -3 },
    whileTap: { y: 0, scale: 0.985 },
    transition: { duration: motionTokens.duration.fast, ease: motionTokens.ease.out },
  },
  /** Button press — tactile feedback. */
  buttonPress: {
    whileHover: { y: -1 },
    whileTap: { scale: 0.96 },
    transition: { duration: motionTokens.duration.instant, ease: motionTokens.ease.standard },
  },
  /** List / stagger container — children animate in sequence. */
  staggerContainer: {
    animate: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
  },
  /** Backwards-compatible alias for `staggerContainer` (used by existing modules). */
  stagger: {
    animate: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
  },
  staggerItem: {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: motionTokens.duration.fast, ease: motionTokens.ease.out },
  },
} as const;

/** Convenience alias matching the brief's naming. */
export const staggerContainer = motionPresets.staggerContainer;

/**
 * Hook returning Motion transition configs that collapse to instant when the
 * user prefers reduced motion. Feed this into every `transition` prop so Nova
 * has one control surface for motion behavior.
 */
export function useNovaMotion() {
  const reduce = useReducedMotion();
  if (!reduce) {
    return motionPresets;
  }
  const instant = { duration: 0 };
  const freeze = (preset: Record<string, unknown>) => ({ ...preset, transition: instant });
  return {
    fadeUp: freeze(motionPresets.fadeUp),
    fadeDown: freeze(motionPresets.fadeDown),
    blurReveal: freeze(motionPresets.blurReveal),
    fade: freeze(motionPresets.fade),
    overlay: freeze(motionPresets.overlay),
    surface: freeze(motionPresets.surface),
    pageTransition: freeze(motionPresets.pageTransition),
    cardReveal: freeze(motionPresets.cardReveal),
    heroReveal: freeze(motionPresets.heroReveal),
    hoverLift: freeze(motionPresets.hoverLift),
    buttonPress: freeze(motionPresets.buttonPress),
    staggerContainer: { animate: { transition: { staggerChildren: 0, delayChildren: 0 } } },
    stagger: { animate: { transition: { staggerChildren: 0, delayChildren: 0 } } },
    staggerItem: freeze(motionPresets.staggerItem),
  };
}
