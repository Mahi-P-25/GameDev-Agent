import { motion } from 'motion/react';
import { Section } from './Section';
import { SectionHeading } from './SectionHeading';
import { EASE } from './constants';

const milestones = [
  {
    date: 'Q3 2025',
    title: 'Alpha Launch',
    description: 'Core capabilities, Unity integration, and mission-driven workflows.',
    active: true,
  },
  {
    date: 'Q4 2025',
    title: 'Plugin SDK',
    description: 'Extend Nova with custom capabilities, engines, and tools.',
    active: false,
  },
  {
    date: 'Q1 2026',
    title: 'Multiplayer',
    description: 'Real-time collaboration. Multiple developers, one Nova session.',
    active: false,
  },
  {
    date: 'Q2 2026',
    title: 'Production Ready',
    description: 'Enterprise-grade reliability, security, and support.',
    active: false,
  },
];

export function RoadmapSection() {
  return (
    <Section id="roadmap">
      <div className="mx-auto max-w-3xl">
        <SectionHeading
          label="Roadmap"
          title="What&apos;s next."
          description="We&apos;re building in public. Here&apos;s what&apos;s coming."
        />

        <div className="relative mt-20">
          <div className="absolute left-[23px] top-0 h-full w-px bg-gradient-to-b from-white/[0.08] via-white/[0.04] to-transparent" />

          <div className="space-y-12">
            {milestones.map((m, i) => (
              <motion.div
                key={m.date}
                className="relative flex gap-6"
                initial={{ opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.6, delay: i * 0.08, ease: EASE }}
              >
                <div className="relative flex-shrink-0">
                  <div
                    className={`flex h-[46px] w-[46px] items-center justify-center rounded-full border backdrop-blur-sm ${
                      m.active
                        ? 'border-white/[0.12] bg-white/[0.06]'
                        : 'border-white/[0.04] bg-white/[0.02]'
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        m.active
                          ? 'bg-white/60 shadow-[0_0_12px_rgba(255,255,255,0.2)]'
                          : 'bg-white/15'
                      }`}
                    />
                  </div>
                </div>

                <div className="flex flex-col justify-center pb-4">
                  <span className="text-[11px] font-medium tracking-widest uppercase text-white/20">
                    {m.date}
                  </span>
                  <h3
                    className={`mt-1 text-lg font-medium ${m.active ? 'text-white/90' : 'text-white/40'}`}
                  >
                    {m.title}
                  </h3>
                  <p className="mt-1 text-[14px] leading-relaxed text-white/30">{m.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}
