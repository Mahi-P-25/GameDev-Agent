import { Glass } from './Glass';
import { Section } from './Section';
import { SectionHeading } from './SectionHeading';

const steps = [
  {
    step: '01',
    title: 'Define Your Mission',
    description:
      'Describe what you want to build in natural language. Nova structures it into a clear plan.',
  },
  {
    step: '02',
    title: 'Review the Strategy',
    description:
      'Nova presents its approach. Approve, adjust, or redirect before any code is written.',
  },
  {
    step: '03',
    title: 'Watch It Build',
    description:
      'Nova works autonomously — writing code, creating assets, and iterating in real time.',
  },
  {
    step: '04',
    title: 'Test & Refine',
    description: 'Built-in testing and validation. Nova catches issues and suggests improvements.',
  },
  {
    step: '05',
    title: 'Ship with Confidence',
    description:
      'Everything is documented, versioned, and ready for your pipeline. No cleanup needed.',
  },
];

export function WorkflowSection() {
  return (
    <Section id="workflow">
        <SectionHeading
          label="Workflow"
          title="From idea to build. No prompt engineering required."
          description="A development loop that feels like collaborating with a senior engineer, not babysitting an AI."
        />

        <div className="mt-20 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {steps.map((step, i) => (
              <Glass key={step.step} variant="subtle" radius="2xl" padding="none">
              <div className="flex h-full flex-col p-8">
                <span className="font-display text-4xl font-normal text-white/10">{step.step}</span>
                <h3 className="mt-6 text-base font-medium text-white/90">{step.title}</h3>
                <p className="mt-2 flex-1 text-[13px] leading-relaxed text-white/35">
                  {step.description}
                </p>
                {i < steps.length - 1 && (
                  <div className="mt-6 flex justify-center sm:hidden">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      className="text-white/[0.06]"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path
                        d="M6 2v8M9 7l-3 3-3-3"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}
              </div>
            </Glass>
          ))}
        </div>
      </Section>
  );
}
