import { type ReactNode, createContext, useContext, useMemo } from 'react';
import { PlaceholderGoalsAdapter } from '../adapters/goalsAdapter';
import { PlaceholderNotificationsAdapter } from '../adapters/notificationsAdapter';
import { PlaceholderStudioRolesAdapter } from '../adapters/studioRolesAdapter';
import type { Goal, Notification, StudioRole } from '../adapters/types';
import type { PlaceholderAdapter } from '../adapters/types';
import { KernelStudioApiClient } from '../services/KernelStudioApiClient';
import type { StudioApiClient } from '../services/StudioApiClient';

/**
 * The composed set of data sources the Nova Studio shell consumes. The UI only
 * ever reads from this context — it never imports backend packages or the
 * adapter implementations directly. Swapping a live client in later touches only
 * this provider, not the components.
 */
export interface StudioDataContextValue {
  readonly api: StudioApiClient;
  readonly goals: PlaceholderAdapter<Goal>;
  readonly roles: PlaceholderAdapter<StudioRole>;
  readonly notifications: PlaceholderAdapter<Notification>;
}

const StudioDataContext = createContext<StudioDataContextValue | null>(null);

export interface StudioDataProviderProps {
  readonly children: ReactNode;
  /** Override the API client (used by tests / future remote client). */
  readonly apiClient?: StudioApiClient;
}

export function StudioDataProvider({ children, apiClient }: StudioDataProviderProps): ReactNode {
  const value = useMemo<StudioDataContextValue>(() => {
    const api = apiClient ?? new KernelStudioApiClient();
    return {
      api,
      goals: new PlaceholderGoalsAdapter(),
      roles: new PlaceholderStudioRolesAdapter(),
      notifications: new PlaceholderNotificationsAdapter(),
    };
  }, [apiClient]);

  return <StudioDataContext.Provider value={value}>{children}</StudioDataContext.Provider>;
}

export function useStudioData(): StudioDataContextValue {
  const ctx = useContext(StudioDataContext);
  if (ctx === null) {
    throw new Error('useStudioData must be used within a StudioDataProvider');
  }
  return ctx;
}
