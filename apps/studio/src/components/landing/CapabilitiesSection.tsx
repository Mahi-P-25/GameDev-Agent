import { Glass } from './Glass';
import { Section } from './Section';
import { SectionHeading } from './SectionHeading';

const capabilities = [
  {
    title: 'Intelligent Context',
    description:
      'Nova understands your full project — architecture, assets, and dependencies — not just the file you have open.',
  },
  {
    title: 'Multi-Modal Creation',
    description:
      'Generate code, 3D models, textures, and audio. Nova speaks every language your game needs.',
  },
  {
    title: 'Autonomous Workflows',
    description:
      'Define missions, not prompts. Nova plans, executes, and iterates without hand-holding.',
  },
  {
    title: 'Native Tooling',
    description:
      'Deep integration with Unity, Unreal Engine, Godot, and your existing pipeline. No context switching.',
  },
];

export function CapabilitiesSection() {
  return (
    <Section id="capabilities">
        <SectionHeading
          label="Capabilities"
          title="A new kind of creative intelligence."
          description="Purpose-built for game development. Nova combines reasoning, creation, and orchestration in a single platform."
        />

        <div className="mt-20 grid gap-6 sm:grid-cols-2">
          {capabilities.map((cap, i) => (
            <Glass key={cap.title} variant="elevated" radius="2xl" padding="none" hover>
              <div className="p-8 sm:p-10">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.03] text-sm text-white/30 backdrop-blur-sm">
                  {i + 1}
                </span>
                <h3 className="mt-6 text-xl font-medium leading-snug text-white/90">
                  {cap.title}
                </h3>
                <p className="mt-3 text-[15px] leading-relaxed text-white/35">
                  {cap.description}
                </p>
              </div>
            </Glass>
          ))}
        </div>
      </Section>
  );
}
