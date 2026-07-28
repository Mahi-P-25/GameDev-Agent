import { useReducedMotion } from 'motion/react';

export const motionTokens = {
  duration: {
    instant: 0.08,
    fast: 0.14,
    base: 0.2,
    slow: 0.32,
    slower: 0.48,
    slowest: 0.72,
  },
  ease: {
    standard: [0.2, 0, 0, 1],
    out: [0.16, 1, 0.3, 1],
    in: [0.4, 0, 1, 1],
    spring: [0.16, 1, 0.3, 1],
  },
  spring: {
    gentle: { type: 'spring' as const, stiffness: 200, damping: 25 },
    snappy: { type: 'spring' as const, stiffness: 300, damping: 20 },
    bouncy: { type: 'spring' as const, stiffness: 150, damping: 12 },
  },
} as const;

export const motionPresets = {
  fadeUp: {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -6 },
    transition: { duration: motionTokens.duration.base, ease: motionTokens.ease.out },
  },
  fadeDown: {
    initial: { opacity: 0, y: -8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -4 },
    transition: { duration: motionTokens.duration.base, ease: motionTokens.ease.out },
  },
  blurReveal: {
    initial: { opacity: 0, y: 12, filter: 'blur(8px)' },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
    exit: { opacity: 0, y: 6, filter: 'blur(6px)' },
    transition: { duration: motionTokens.duration.slow, ease: motionTokens.ease.out },
  },
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: motionTokens.duration.fast, ease: motionTokens.ease.standard },
  },
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
  pageTransition: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -6 },
    transition: { duration: motionTokens.duration.slow, ease: motionTokens.ease.out },
  },
  cardReveal: {
    initial: { opacity: 0, y: 16, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -8, scale: 0.99 },
    transition: { duration: motionTokens.duration.slow, ease: motionTokens.ease.out },
  },
  heroReveal: {
    initial: { opacity: 0, y: 24, filter: 'blur(10px)' },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
    exit: { opacity: 0, y: -12, filter: 'blur(8px)' },
    transition: { duration: motionTokens.duration.slower, ease: motionTokens.ease.out },
  },
  hoverLift: {
    initial: { y: 0 },
    whileHover: { y: -3 },
    whileTap: { y: 0, scale: 0.985 },
    transition: { duration: motionTokens.duration.fast, ease: motionTokens.ease.out },
  },
  buttonPress: {
    whileHover: { y: -1 },
    whileTap: { scale: 0.96 },
    transition: { duration: motionTokens.duration.instant, ease: motionTokens.ease.standard },
  },
  staggerContainer: {
    animate: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
  },
  stagger: {
    animate: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
  },
  staggerItem: {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: motionTokens.duration.fast, ease: motionTokens.ease.out },
  },
} as const;

export const staggerContainer = motionPresets.staggerContainer;

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
