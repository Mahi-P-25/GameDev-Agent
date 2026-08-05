import { ConversationStoreProvider } from '../services/ConversationStoreProvider';
import { ChatCockpit } from '../components/cockpit/ChatCockpit';
import { Page } from '../components/layout/Page';

function HomeCockpitContent(): React.ReactNode {
  return (
    <Page title="Cockpit">
      <div className="h-[calc(100vh-100px)] w-full overflow-hidden rounded-2xl border border-border/80 bg-bg-panel/90 shadow-2xl backdrop-blur-2xl">
        <ChatCockpit />
      </div>
    </Page>
  );
}

export function HomePage(): React.ReactNode {
  return (
    <ConversationStoreProvider>
      <HomeCockpitContent />
    </ConversationStoreProvider>
  );
}
