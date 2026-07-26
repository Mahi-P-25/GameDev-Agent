import { Page } from '../components/layout/Page';
import { MissionControlModule } from '../modules/mission-control';

/**
 * Mission Control — the full-page view reachable from anywhere in the studio.
 * Renders the same {@link MissionControlModule} that anchors the Home surface, so
 * the experience is identical whether inline or on its own route.
 */
export function MissionControlPage(): React.ReactNode {
  return (
    <Page title="Mission Control" status="ready" gridClass="nova-grid--home">
      <MissionControlModule />
    </Page>
  );
}
