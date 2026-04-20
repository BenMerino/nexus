import type { EnrichedSimNode } from './relationship-types';
import { COMMUNITY_COLORS } from './relationship-types';
import type { ExplorerAffiliations } from './explorer-affiliations';

export type GroupByDim = 'none' | 'institution' | 'journal' | 'year';

export interface ExplorerHullGroup {
  key: string;
  label: string;
  color: string;
  points: { x: number; y: number }[];
}

function pickColor(i: number) { return COMMUNITY_COLORS[i % COMMUNITY_COLORS.length]; }

function groupByAuthorLink(
  nodes: EnrichedSimNode[],
  hubGroup: 'institution' | 'journal',
  lookup: Map<string, Set<string>>,
): ExplorerHullGroup[] {
  const hubs = nodes.filter(n => n.group === hubGroup);
  const authors = nodes.filter(n => n.group === 'author');
  const groups: ExplorerHullGroup[] = [];
  hubs.forEach((hub, i) => {
    const points: { x: number; y: number }[] = [{ x: hub.x, y: hub.y }];
    for (const a of authors) {
      if (lookup.get(a.id)?.has(hub.id)) points.push({ x: a.x, y: a.y });
    }
    groups.push({ key: hub.id, label: hub.label, color: pickColor(i), points });
  });
  return groups;
}

function groupByYear(nodes: EnrichedSimNode[], yearByDoi: Map<string, string>): ExplorerHullGroup[] {
  const byYear = new Map<string, { x: number; y: number }[]>();
  for (const n of nodes) {
    if (n.group !== 'doi') continue;
    const y = yearByDoi.get(n.id);
    if (!y) continue;
    const list = byYear.get(y) || [];
    list.push({ x: n.x, y: n.y });
    byYear.set(y, list);
  }
  return [...byYear.keys()].sort().map((y, i) => ({
    key: 'year:' + y,
    label: y,
    color: pickColor(i),
    points: byYear.get(y)!,
  }));
}

export function buildExplorerHullGroups(
  dim: GroupByDim,
  nodes: EnrichedSimNode[],
  affiliations: ExplorerAffiliations,
): ExplorerHullGroup[] {
  if (dim === 'none') return [];
  if (dim === 'institution') return groupByAuthorLink(nodes, 'institution', affiliations.institutionsByAuthor);
  if (dim === 'journal') return groupByAuthorLink(nodes, 'journal', affiliations.journalsByAuthor);
  if (dim === 'year') return groupByYear(nodes, affiliations.yearByDoi);
  return [];
}
