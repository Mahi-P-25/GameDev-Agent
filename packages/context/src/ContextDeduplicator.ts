import type { ContextItem } from './ContextPackage';

export class ContextDeduplicator {
  deduplicate(items: readonly ContextItem[]): ContextItem[] {
    const seen = new Map<string, ContextItem>();

    for (const item of items) {
      const key = item.dedupKey;
      if (key === undefined || key === null) {
        continue;
      }

      const existing = seen.get(key);
      if (existing === undefined) {
        seen.set(key, item);
      } else if (item.relevance > existing.relevance) {
        seen.set(key, item);
      }
    }

    const result: ContextItem[] = [];
    for (const item of items) {
      const key = item.dedupKey;
      if (key === undefined || key === null) {
        result.push(item);
        continue;
      }
      const best = seen.get(key);
      if (best !== undefined && best.id === item.id) {
        result.push(item);
      }
    }

    return result;
  }

  findDuplicates(items: readonly ContextItem[]): Map<string, ContextItem[]> {
    const groups = new Map<string, ContextItem[]>();

    for (const item of items) {
      const key = item.dedupKey;
      if (key === undefined || key === null) {
        continue;
      }
      const group = groups.get(key);
      if (group === undefined) {
        groups.set(key, [item]);
      } else {
        group.push(item);
      }
    }

    const duplicates = new Map<string, ContextItem[]>();
    for (const [key, group] of groups) {
      if (group.length > 1) {
        duplicates.set(key, group);
      }
    }

    return duplicates;
  }
}
