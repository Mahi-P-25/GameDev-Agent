import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from '../../design/cn';
import { EASE, VIEWPORT } from './constants';

type GlassVariant = 'subtle' | 'elevated' | 'intense' | 'frosted';
type GlassRadius = 'sm' | 'md' | 'lg' | 'xl' | '2xl';
type GlassPadding = 'none' | 'sm' | 'md' | 'lg' | 'xl';

interface GlassProps {
  children: ReactNode;
  variant?: GlassVariant;
  radius?: GlassRadius;
  padding?: GlassPadding;
  hover?: boolean;
  className?: string;
}

const variantClasses: Record<GlassVariant, string> = {
  subtle: [
    'bg-white/[0.015]',
    'border border-white/[0.03]',
    'shadow-[0_2px_8px_rgba(0,0,0,0.20),0_8px_24px_rgba(0,0,0,0.15)]',
  ].join(' '),
  elevated: [
    'bg-white/[0.03]',
    'border border-white/[0.06]',
    'shadow-[0_4px_12px_rgba(0,0,0,0.25),0_12px_40px_rgba(0,0,0,0.20),inset_0_1px_0_rgba(255,255,255,0.03)]',
  ].join(' '),
  intense: [
    'bg-white/[0.05]',
    'border border-white/[0.10]',
    'shadow-[0_8px_24px_rgba(0,0,0,0.35),0_20px_60px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.04)]',
  ].join(' '),
  frosted: [
    'bg-white/[0.04]',
    'border border-white/[0.08]',
    'shadow-[0_4px_16px_rgba(0,0,0,0.30),0_12px_48px_rgba(0,0,0,0.20)]',
    'backdrop-blur-[32px]',
    'backdrop-saturate-[1.6]',
  ].join(' '),
};

const radiusClasses: Record<GlassRadius, string> = {
  sm: 'rounded-[12px]',
  md: 'rounded-[16px]',
  lg: 'rounded-[20px]',
  xl: 'rounded-[24px]',
  '2xl': 'rounded-[28px]',
};

const paddingClasses: Record<GlassPadding, string> = {
  none: 'p-0',
  sm: 'p-4 sm:p-5',
  md: 'p-5 sm:p-6',
  lg: 'p-6 sm:p-8',
  xl: 'p-8 sm:p-10',
};

export function Glass({
  children,
  variant = 'elevated',
  radius = '2xl',
  padding = 'md',
  hover = false,
  className,
}: GlassProps) {
  const classes = cn(
    'relative backdrop-blur-[24px] backdrop-saturate-[1.4]',
    'transition-[border-color,box-shadow,transform] duration-300 ease-out',
    variantClasses[variant],
    radiusClasses[radius],
    paddingClasses[padding],
    hover && 'cursor-pointer',
    className,
  );

  return (
    <motion.div
      className={classes}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT}
      transition={{ duration: 0.6, ease: EASE }}
      {...(hover && {
        whileHover: {
          y: -4,
          scale: 1.005,
          boxShadow:
            '0 12px 40px rgba(0,0,0,0.40), 0 30px 80px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.04)',
          transition: { duration: 0.3, ease: EASE },
        },
      })}
    >
      {children}
    </motion.div>
  );
}
