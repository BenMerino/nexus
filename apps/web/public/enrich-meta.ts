import type { EnrichedTagNode } from './relationship-types';

export type TagMetaMap = Record<string, { avgCitations: number; openAccessPct: number; topKeywords: string[] }>;

export function enrichWithMeta(nodes: EnrichedTagNode[], tagMeta: TagMetaMap): EnrichedTagNode[] {
  if (!Object.keys(tagMeta).length) return nodes;
  const citValues = nodes.map(n => tagMeta[n.id]?.avgCitations || 0).sort((a, b) => a - b);
  const citP70 = citValues[Math.floor(citValues.length * 0.7)] || 0;
  return nodes.map(n => {
    const meta = tagMeta[n.id];
    if (!meta) return n;
    const haloIntensity = meta.avgCitations > citP70 ? Math.min(1, (meta.avgCitations - citP70) / (citP70 || 1)) : 0;
    return { ...n, haloIntensity, openAccess: meta.openAccessPct > 0.5, topKeywords: meta.topKeywords };
  });
}
