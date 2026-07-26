import { Page } from '../components/layout/Page';
import { StudioPresenceModule } from '../modules/studio-presence';

/**
 * Home — the opening scene of the Nova operating system.
 *
 * The first viewport is almost entirely the active project (StudioPresenceModule
 * renders the dominant Project hero + quiet supporting context). Mission Control
 * is reached from the hero's primary action, not stacked here — so the studio
 * reads as a room you enter, not a dashboard of equal sections.
 *
 * No backend package is imported here; the module reads only the `StudioApi`
 * façade through its own hook.
 */
export function HomePage(): React.ReactNode {
  return (
    <Page title="Studio" status="ready" gridClass="nova-grid--home">
      <StudioPresenceModule />
    </Page>
  );
}
