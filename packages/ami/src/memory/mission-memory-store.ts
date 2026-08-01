import type { IMissionMemoryStore } from '../reasoning/interfaces';
import type { MemoryQuery, MemoryRecord } from './memory-query';
import type { MemoryProvider } from './providers/in-memory-provider';

/** Default number of recent records folded into `summarize`. */
const DEFAULT_SUMMARY_LIMIT = 10;

/** Hard cap on the summarized string so it never grows unbounded. */
const DEFAULT_SUMMARY_MAX_LENGTH = 4_000;

/**
 * Mission-scoped memory store. All reads/writes are delegated to an injected
 * {@link MemoryProvider} (constructor injection). `summarize` folds the most
 * recent N records into a bounded-length string, truncating with a clear
 * marker when the record count or byte budget is exceeded.
 */
export class MissionMemoryStore implements IMissionMemoryStore {
  constructor(
    private readonly provider: MemoryProvider,
    private readonly summaryLimit: number = DEFAULT_SUMMARY_LIMIT,
    private readonly summaryMaxLength: number = DEFAULT_SUMMARY_MAX_LENGTH,
  ) {}

  write(record: MemoryRecord): Promise<void> {
    return this.provider.write(record);
  }

  query(query: MemoryQuery): Promise<MemoryRecord[]> {
    return this.provider.query(query);
  }

  async summarize(missionId: string): Promise<string> {
    const recent = await this.provider.query({ missionId, limit: this.summaryLimit });
    const omitted = await this.countForMission(missionId);

    const lines = recent.map((r) => this.formatRecord(r));
    let body = lines.join('\n');
    if (omitted > this.summaryLimit) {
      body = `${body}\n...${omitted - this.summaryLimit} earlier records omitted`;
    }

    if (body.length > this.summaryMaxLength) {
      const marker = '\n...[summary truncated]';
      const budget = Math.max(0, this.summaryMaxLength - marker.length);
      body = `${body.slice(0, budget)}${marker}`;
    }
    return body;
  }

  private async countForMission(missionId: string): Promise<number> {
    const all = await this.provider.query({ missionId });
    return all.length;
  }

  private formatRecord(record: MemoryRecord): string {
    const evidence = record.evidence !== undefined ? ` evidence=${JSON.stringify(record.evidence)}` : '';
    const node = record.goalNodeId !== undefined ? ` node=${record.goalNodeId}` : '';
    return `[${record.kind}]${node} ${record.content}${evidence}`;
  }
}
