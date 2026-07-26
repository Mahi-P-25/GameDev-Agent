import { motion } from 'motion/react';
import { AnimatedTerrain } from './AnimatedTerrain';
import { EASE } from './constants';

export function HeroSection() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6">
      <AnimatedTerrain />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_50%_45%,rgba(255,255,255,0.025),transparent)]" />

      <div className="relative z-10 mx-auto max-w-6xl">
        <motion.h1
          className="text-center font-geist font-extrabold leading-[0.80] tracking-[-0.06em] text-white"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.18, delayChildren: 0.35 } },
          }}
        >
          <motion.span
            className="block text-[clamp(4rem,15vw,10rem)]"
            variants={{
              hidden: { opacity: 0, y: 24, filter: 'blur(8px)' },
              visible: {
                opacity: 1,
                y: 0,
                filter: 'blur(0px)',
                transition: { duration: 0.7, ease: EASE },
              },
            }}
          >
            Build
          </motion.span>
          <motion.span
            className="block text-[clamp(4rem,15vw,10rem)]"
            variants={{
              hidden: { opacity: 0, y: 24, filter: 'blur(8px)' },
              visible: {
                opacity: 1,
                y: 0,
                filter: 'blur(0px)',
                transition: { duration: 0.7, ease: EASE },
              },
            }}
          >
            Games.
          </motion.span>
          <motion.span
            className="block text-[clamp(2.25rem,7vw,5.5rem)] font-normal tracking-[-0.03em] text-white/40"
            variants={{
              hidden: { opacity: 0, y: 24, filter: 'blur(8px)' },
              visible: {
                opacity: 1,
                y: 0,
                filter: 'blur(0px)',
                transition: { duration: 0.7, ease: EASE },
              },
            }}
          >
            Not Prompts.
          </motion.span>
        </motion.h1>

        <motion.p
          className="mx-auto mt-20 max-w-lg text-center font-geist text-[clamp(0.875rem,1.1vw,1.125rem)] leading-relaxed tracking-[0.02em] text-white/30"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 1.1 }}
        >
          Nova is the AI-native operating system for modern game development.
        </motion.p>

        <motion.div
          className="mt-12 flex items-center justify-center gap-4"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 1.4 }}
        >
          <a
            href="https://nova.game/app"
            className="inline-flex h-12 items-center rounded-full bg-white px-8 text-[15px] font-medium text-black transition-all hover:bg-white/90 hover:shadow-[0_0_40px_-8px_rgba(255,255,255,0.25)]"
          >
            Launch Nova
          </a>
          <a
            href="https://github.com/gamedev-agent/nova"
            className="inline-flex h-12 items-center rounded-full border border-white/[0.08] bg-white/[0.02] px-8 text-[15px] font-medium text-white/50 backdrop-blur-sm transition-all hover:border-white/[0.15] hover:text-white/80"
          >
            GitHub
          </a>
        </motion.div>
      </div>
    </section>
  );
}
