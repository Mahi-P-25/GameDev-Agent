import { NovaWordmark } from '../brand';

const footerLinks = [
  {
    label: 'Product',
    links: [
      { label: 'Features', href: '#capabilities' },
      { label: 'Architecture', href: '#architecture' },
      { label: 'Roadmap', href: '#roadmap' },
    ],
  },
  {
    label: 'Resources',
    links: [
      { label: 'Documentation', href: 'https://nova.game/docs' },
      { label: 'GitHub', href: 'https://github.com/gamedev-agent/nova' },
      { label: 'Status', href: 'https://nova.game/status' },
    ],
  },
  {
    label: 'Company',
    links: [
      { label: 'About', href: 'https://nova.game/about' },
      { label: 'Blog', href: 'https://nova.game/blog' },
      { label: 'Contact', href: 'https://nova.game/contact' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative border-t border-white/[0.04] px-6 py-16">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <NovaWordmark size="sm" withEyebrow={false} />
            <p className="mt-3 text-[13px] leading-relaxed text-white/25">
              AI-native development OS for game developers.
            </p>
          </div>

          {footerLinks.map((group) => (
            <div key={group.label}>
              <h4 className="text-[11px] font-medium tracking-widest uppercase text-white/20">
                {group.label}
              </h4>
              <ul className="mt-4 space-y-3">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-[14px] text-white/35 transition-colors hover:text-white/70"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 border-t border-white/[0.04] pt-8">
          <p className="text-[12px] text-white/15">
            &copy; {2026} Nova. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
