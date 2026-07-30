import { type ReactNode, createContext, useContext, useMemo } from 'react';
import { PlaceholderGoalsAdapter } from '../adapters/goalsAdapter';
import { PlaceholderNotificationsAdapter } from '../adapters/notificationsAdapter';
import { PlaceholderStudioRolesAdapter } from '../adapters/studioRolesAdapter';
import type { Goal, Notification, StudioRole } from '../adapters/types';
import type { PlaceholderAdapter } from '../adapters/types';
import { KernelMissionExecutionAdapter } from '../adapters/KernelMissionExecutionAdapter';
import type { MissionExecutionAdapter } from '../adapters/missionExecutionAdapter';
import { ProjectIntelligenceEngine } from '../adapters/projectIntelligence/engine';
import { KernelStudioApiClient } from '../services/KernelStudioApiClient';
import type { StudioApiClient } from '../services/StudioApiClient';

export interface StudioDataContextValue {
  readonly api: StudioApiClient;
  readonly goals: PlaceholderAdapter<Goal>;
  readonly roles: PlaceholderAdapter<StudioRole>;
  readonly notifications: PlaceholderAdapter<Notification>;
  readonly missionExecution: MissionExecutionAdapter;
  readonly projectIntelligence: ProjectIntelligenceEngine;
}

const StudioDataContext = createContext<StudioDataContextValue | null>(null);

export interface StudioDataProviderProps {
  readonly children: ReactNode;
  readonly apiClient?: StudioApiClient;
  readonly missionExecutionAdapter?: MissionExecutionAdapter;
  readonly projectIntelligenceEngine?: ProjectIntelligenceEngine;
}

export function StudioDataProvider({ children, apiClient, missionExecutionAdapter, projectIntelligenceEngine }: StudioDataProviderProps): ReactNode {
  const value = useMemo<StudioDataContextValue>(() => {
    const api = apiClient ?? new KernelStudioApiClient();
    return {
      api,
      goals: new PlaceholderGoalsAdapter(),
      roles: new PlaceholderStudioRolesAdapter(),
      notifications: new PlaceholderNotificationsAdapter(),
      missionExecution: missionExecutionAdapter ?? new KernelMissionExecutionAdapter(api),
      projectIntelligence: projectIntelligenceEngine ?? new ProjectIntelligenceEngine(),
    };
  }, [apiClient, missionExecutionAdapter, projectIntelligenceEngine]);

  return <StudioDataContext.Provider value={value}>{children}</StudioDataContext.Provider>;
}

export function useStudioData(): StudioDataContextValue {
  const ctx = useContext(StudioDataContext);
  if (ctx === null) {
    throw new Error('useStudioData must be used within a StudioDataProvider');
  }
  return ctx;
}
