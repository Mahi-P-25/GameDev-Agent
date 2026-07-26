import { motion } from 'motion/react';
import { cn } from '../../design/cn';
import { EASE, VIEWPORT } from './constants';

interface SectionHeadingProps {
  label: string;
  title: string;
  description?: string;
  className?: string;
  align?: 'center' | 'left';
}

export function SectionHeading({
  label,
  title,
  description,
  className,
  align = 'center',
}: SectionHeadingProps) {
  return (
    <motion.div
      className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center', className)}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT}
      transition={{ duration: 0.6, ease: EASE }}
    >
      <span className="inline-block rounded-full border border-white/[0.06] bg-white/[0.03] px-4 py-1.5 text-[11px] font-medium tracking-widest uppercase text-white/40 backdrop-blur-sm">
        {label}
      </span>
      <h2 className="mt-6 font-display text-4xl font-normal leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-base leading-relaxed text-white/40 sm:text-lg">{description}</p>
      )}
    </motion.div>
  );
}
