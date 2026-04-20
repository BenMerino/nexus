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

function groupByInstitution(
  nodes: EnrichedSimNode[],
  institutionsByAuthor: Map<string, Set<string>>,
): ExplorerHullGroup[] {
  const hubs = nodes.filter(n => n.group === 'institution');
  const authors = nodes.filter(n => n.group === 'author');
  return hubs.map((hub, i) => {
    const points: { x: number; y: number }[] = [{ x: hub.x, y: hub.y }];
    for (const a of authors) {
      if (institutionsByAuthor.get(a.id)?.has(hub.id)) points.push({ x: a.x, y: a.y });
    }
    return { key: hub.id, label: hub.label, color: pickColor(i), points };
  });
}

function groupByJournalHub(
  nodes: EnrichedSimNode[],
  journalsByAuthor: Map<string, Set<string>>,
  doisByJournal: Map<string, Set<string>>,
): ExplorerHullGroup[] {
  const hubs = nodes.filter(n => n.group === 'journal');
  const authors = nodes.filter(n => n.group === 'author');
  const dois = nodes.filter(n => n.group === 'doi');
  return hubs.map((hub, i) => {
    const points: { x: number; y: number }[] = [{ x: hub.x, y: hub.y }];
    for (const a of authors) {
      if (journalsByAuthor.get(a.id)?.has(hub.id)) points.push({ x: a.x, y: a.y });
    }
    for (const d of dois) {
      if (doisByJournal.get(hub.id)?.has(d.id)) points.push({ x: d.x, y: d.y });
    }
    return { key: hub.id, label: hub.label, color: pickColor(i), points };
  });
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
  if (dim === 'institution') return groupByInstitution(nodes, affiliations.institutionsByAuthor);
  if (dim === 'journal') return groupByJournalHub(nodes, affiliations.journalsByAuthor, affiliations.doisByJournal);
  if (dim === 'year') return groupByYear(nodes, affiliations.yearByDoi);
  return [];
}
