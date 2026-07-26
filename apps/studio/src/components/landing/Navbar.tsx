import { motion } from 'motion/react';
import { NovaMark } from '../brand';
import { EASE } from './constants';

const links = [
  { label: 'Features', href: '#capabilities' },
  { label: 'Architecture', href: '#architecture' },
  { label: 'Docs', href: 'https://nova.game/docs' },
  { label: 'GitHub', href: 'https://github.com/gamedev-agent/nova' },
];

export function Navbar() {
  return (
    <motion.header
      className="fixed inset-x-0 top-0 z-50 flex justify-center pt-6"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: EASE, delay: 0.2 }}
    >
      <nav className="flex items-center gap-6 rounded-full border border-white/[0.06] bg-black/40 px-5 py-2.5 shadow-2xl shadow-black/40 backdrop-blur-2xl">
        <a href="/" className="flex items-center gap-2 text-white/80 hover:text-white">
          <NovaMark size="sm" />
          <span className="text-sm font-medium">Nova</span>
        </a>

        <div className="h-4 w-px bg-white/[0.06]" />

        {links.map((link) => (
          <a
            key={link.label}
            href={link.href}
            className="text-[13px] text-white/40 transition-colors hover:text-white/80"
          >
            {link.label}
          </a>
        ))}

        <div className="h-4 w-px bg-white/[0.06]" />

        <a
          href="https://nova.game/app"
          className="rounded-full bg-white px-4 py-1.5 text-[13px] font-medium text-black transition-all hover:bg-white/90"
        >
          Launch Nova
        </a>
      </nav>
    </motion.header>
  );
}
