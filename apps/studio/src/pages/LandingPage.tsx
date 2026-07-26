import { useEffect } from 'react';
import {
  ArchitectureSection,
  CapabilitiesSection,
  Footer,
  HeroSection,
  Navbar,
  RoadmapSection,
  WorkflowSection,
} from '../components/landing';

export function LandingPage() {
  useEffect(() => {
    document.title = 'Nova — AI-Native Game Development OS';
  }, []);

  return (
    <div className="min-h-screen bg-[#08090c] font-geist text-white selection:bg-white/10">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(255,255,255,0.04),transparent)]" />
      </div>

      <Navbar />
      <main>
        <HeroSection />
        <CapabilitiesSection />
        <ArchitectureSection />
        <WorkflowSection />
        <RoadmapSection />
      </main>
      <Footer />
    </div>
  );
}
