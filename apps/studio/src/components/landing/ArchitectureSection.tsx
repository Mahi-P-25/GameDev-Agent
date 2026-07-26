import { Glass } from './Glass';
import { Section } from './Section';
import { SectionHeading } from './SectionHeading';

const layers = [
  {
    name: 'Capabilities Layer',
    description: 'Multi-modal AI models fine-tuned for game development — code, 3D, audio, and design.',
  },
  {
    name: 'Orchestration',
    description: 'Mission-driven planning engine that decomposes goals into verifiable subtasks.',
  },
  {
    name: 'Tool Runtime',
    description: 'Sandboxed execution environment with deep engine SDK integrations.',
  },
  {
    name: 'Engine Bridge',
    description: 'Direct Unity, Unreal, and Godot integrations with real-time bidirectional sync.',
  },
];

export function ArchitectureSection() {
  return (
    <Section id="architecture">
        <SectionHeading
          label="Architecture"
          title="Designed for depth."
          description="Every layer is purpose-built for the complexity of game development."
        />

        <div className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {layers.map((layer, i) => (
            <Glass key={layer.name} variant="subtle" radius="2xl" padding="none">
              <div className="flex h-full flex-col p-8">
                <span className="text-[11px] font-medium tracking-widest uppercase text-white/20">
                  Layer {i + 1}
                </span>
                <h3 className="mt-3 text-lg font-medium text-white/90">{layer.name}</h3>
                <p className="mt-3 flex-1 text-[14px] leading-relaxed text-white/35">
                  {layer.description}
                </p>
                <div className="mt-6 h-px w-full bg-gradient-to-r from-white/[0.06] to-transparent" />
              </div>
            </Glass>
          ))}
        </div>
      </Section>
  );
}