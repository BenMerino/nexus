import type { EnrichedSimNode, ProjectedEdge } from './relationship-types';
import { COMMUNITY_COLORS } from './relationship-types';

export type GroupByDim = 'none' | 'institution' | 'journal' | 'year';

export interface ExplorerHullGroup {
  key: string;
  label: string;
  color: string;
  points: { x: number; y: number }[];
}

/** Build hull groups around institution hubs. For each institution node, the
 *  hull contains that institution plus every author node it's connected to. */
function groupByInstitution(nodes: EnrichedSimNode[], edges: ProjectedEdge[]): ExplorerHullGroup[] {
  const institutions = nodes.filter(n => n.group === 'institution');
  const nodeById = new Map(nodes.map(n => [n.id, n]));
  const groups: ExplorerHullGroup[] = [];
  institutions.forEach((inst, i) => {
    const points: { x: number; y: number }[] = [{ x: inst.x, y: inst.y }];
    for (const e of edges) {
      const sId = typeof e.source === 'object' ? (e.source as EnrichedSimNode).id : e.source;
      const tId = typeof e.target === 'object' ? (e.target as EnrichedSimNode).id : e.target;
      const other = sId === inst.id ? tId : tId === inst.id ? sId : null;
      if (!other) continue;
      const n = nodeById.get(other);
      if (n && n.group === 'author') points.push({ x: n.x, y: n.y });
    }
    groups.push({
      key: inst.id, label: inst.label,
      color: COMMUNITY_COLORS[i % COMMUNITY_COLORS.length],
      points,
    });
  });
  return groups;
}

function groupByJournal(nodes: EnrichedSimNode[], edges: ProjectedEdge[]): ExplorerHullGroup[] {
  const journals = nodes.filter(n => n.group === 'journal');
  const nodeById = new Map(nodes.map(n => [n.id, n]));
  const groups: ExplorerHullGroup[] = [];
  journals.forEach((j, i) => {
    const points: { x: number; y: number }[] = [{ x: j.x, y: j.y }];
    for (const e of edges) {
      const sId = typeof e.source === 'object' ? (e.source as EnrichedSimNode).id : e.source;
      const tId = typeof e.target === 'object' ? (e.target as EnrichedSimNode).id : e.target;
      const other = sId === j.id ? tId : tId === j.id ? sId : null;
      if (!other) continue;
      const n = nodeById.get(other);
      if (n && (n.group === 'author' || n.group === 'doi')) points.push({ x: n.x, y: n.y });
    }
    groups.push({
      key: j.id, label: j.label,
      color: COMMUNITY_COLORS[i % COMMUNITY_COLORS.length],
      points,
    });
  });
  return groups;
}

/** Group paper/doi nodes by their publication year (extracted from the label's
 *  first 4-digit run, since the RawNode shape carries `published` but projection
 *  doesn't forward it). */
function groupByYear(nodes: EnrichedSimNode[], rawYears: Map<string, string>): ExplorerHullGroup[] {
  const byYear = new Map<string, { x: number; y: number }[]>();
  for (const n of nodes) {
    if (n.group !== 'doi') continue;
    const y = rawYears.get(n.id)?.slice(0, 4);
    if (!y) continue;
    const list = byYear.get(y) || [];
    list.push({ x: n.x, y: n.y });
    byYear.set(y, list);
  }
  const years = [...byYear.keys()].sort();
  return years.map((y, i) => ({
    key: 'year:' + y,
    label: y,
    color: COMMUNITY_COLORS[i % COMMUNITY_COLORS.length],
    points: byYear.get(y)!,
  }));
}

export function buildExplorerHullGroups(
  dim: GroupByDim,
  nodes: EnrichedSimNode[],
  edges: ProjectedEdge[],
  rawYears: Map<string, string>,
): ExplorerHullGroup[] {
  if (dim === 'none') return [];
  if (dim === 'institution') return groupByInstitution(nodes, edges);
  if (dim === 'journal') return groupByJournal(nodes, edges);
  if (dim === 'year') return groupByYear(nodes, rawYears);
  return [];
}
