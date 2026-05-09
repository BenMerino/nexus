import { useMemo } from 'react';
import type { RawNode, RawEdge } from './relationship-types';

export interface TagEntry { id: string; label: string; doiCount: number }

/** Compute per-category tag lists and counts from raw graph data */
export function useTagCounts(rawNodes: RawNode[], rawEdges: RawEdge[]) {
  return useMemo(() => {
    const counts: Record<string, number> = {};
    const doiPerTag = new Map<string, number>();
    for (const e of rawEdges) doiPerTag.set(e.target, (doiPerTag.get(e.target) || 0) + 1);
    const byCategory: Record<string, TagEntry[]> = {};
    for (const n of rawNodes) {
      if (n.group === 'doi') continue;
      counts[n.group] = (counts[n.group] || 0) + 1;
      (byCategory[n.group] ||= []).push({ id: n.id, label: n.label, doiCount: doiPerTag.get(n.id) || 0 });
    }
    for (const cat of Object.keys(byCategory)) byCategory[cat].sort((a, b) => b.doiCount - a.doiCount);
    return { categoryCounts: counts, tagsByCategory: byCategory };
  }, [rawNodes, rawEdges]);
}
