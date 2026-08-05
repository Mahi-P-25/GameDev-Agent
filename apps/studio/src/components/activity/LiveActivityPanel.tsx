import type { StudioActivity } from '@gamedev-agent/studio-api';
import { useEffect, useState } from 'react';
import { useStudioData } from '../../studio/StudioDataProvider';
import { ActivityFeed, type ActivityEvent, type ActivityKind } from './ActivityFeed';

function kindFor(kind: string): ActivityKind {
  if (/failed|error|cancelled|rejected/.test(kind)) {
    return 'warning';
  }
  if (/completed|created|approved|opened|ready/.test(kind)) {
    return 'success';
  }
  return 'progress';
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return '--:--:--';
  }
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

function toFeedEvent(activity: StudioActivity): ActivityEvent {
  return {
    id: activity.seq,
    kind: kindFor(activity.kind),
    message: activity.message,
    timestamp: formatTime(activity.timestamp),
  };
}

export interface LiveActivityPanelProps {
  readonly className?: string;
  readonly maxRows?: number;
}

/**
 * LiveActivityPanel — a real-time activity feed fed by the Studio API's
 * normalized {@link StudioActivity} stream. Seeds with recent history and
 * appends live events as missions, projects, and goals move through Nova.
 */
export function LiveActivityPanel({ className, maxRows = 30 }: LiveActivityPanelProps): React.ReactNode {
  const { api } = useStudioData();
  const [events, setEvents] = useState<ReadonlyArray<ActivityEvent>>([]);

  useEffect(() => {
    if (!api.ready) {
      return;
    }
    setEvents(api.getActivity(maxRows).map(toFeedEvent));
    const subscription = api.onActivity((activity) => {
      setEvents((prev) => [...prev.slice(-(maxRows - 1)), toFeedEvent(activity)]);
    });
    return () => {
      subscription.dispose();
    };
  }, [api, maxRows]);

  return (
    <ActivityFeed
      events={events}
      maxRows={maxRows}
      {...(className !== undefined ? { className } : {})}
    />
  );
}
