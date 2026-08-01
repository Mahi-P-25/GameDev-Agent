import { useCallback, useEffect, useState } from 'react';
import type { ProjectContext } from '../adapters/projectIntelligence/types';
import { Page } from '../components/layout/Page';
import { ProjectIntelligenceView } from '../components/project/ProjectIntelligenceView';
import { useStudioData } from '../studio/StudioDataProvider';

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
      <div className="mx-auto w-full max-w-5xl">
        <ProjectIntelligenceView context={context} loading={loading} onRefresh={handleRefresh} />
      </div>
    </Page>
  );
}
