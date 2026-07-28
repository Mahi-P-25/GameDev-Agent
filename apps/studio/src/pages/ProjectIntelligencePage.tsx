import { useCallback, useEffect, useState } from 'react';
import { Page } from '../components/layout/Page';
import { ProjectIntelligenceView } from '../components/project/ProjectIntelligenceView';
import { useStudioData } from '../studio/StudioDataProvider';
import type { ProjectContext } from '../adapters/projectIntelligence/types';

export function ProjectIntelligencePage(): React.ReactNode {
  const { projectIntelligence } = useStudioData();
  const [context, setContext] = useState<ProjectContext | null>(null);
  const [loading, setLoading] = useState(true);

  const scan = useCallback(async () => {
    setLoading(true);
    try {
      const ctx = await projectIntelligence.scanWorkspace();
      setContext(ctx);
    } catch {
      setContext(null);
    } finally {
      setLoading(false);
    }
  }, [projectIntelligence]);

  useEffect(() => {
    scan();
  }, [scan]);

  const handleRefresh = useCallback(() => {
    projectIntelligence.invalidateCache();
    scan();
  }, [scan, projectIntelligence]);

  return (
    <Page title="Project Intelligence">
      <div className="glass-panel-premium px-7 py-6">
        <ProjectIntelligenceView
          context={context}
          loading={loading}
          onRefresh={handleRefresh}
        />
      </div>
    </Page>
  );
}
