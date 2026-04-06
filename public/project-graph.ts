import type { RawNode, RawEdge, TagNode, ProjectedEdge, Category, EnrichedTagNode } from './relationship-types';
import { classifyNodes } from './node-classify';
import { leiden } from './leiden';

const MAX_NODES = 150;
const MAX_EDGES = 600;

export function projectGraph(
  rawNodes: RawNode[],
  rawEdges: RawEdge[],
  activeCategories: Set<Category>,
  pinnedTags: string[],
): { nodes: EnrichedTagNode[]; edges: ProjectedEdge[]; matchingDois: Set<string> } {
  const pinnedSet = new Set(pinnedTags);
  const doiToTags = new Map<string, string[]>();
  const doiLabels = new Map<string, string>();

  for (const n of rawNodes) {
    if (n.group === 'doi') doiLabels.set(n.id, n.label);
  }
  for (const e of rawEdges) {
    const list = doiToTags.get(e.source) || [];
    list.push(e.target);
    doiToTags.set(e.source, list);
  }

  // Build pinned-tag sets per category
  const pinnedByCategory = new Map<string, Set<string>>();
  for (const id of pinnedSet) {
    const node = rawNodes.find(n => n.id === id);
    if (node) {
      let set = pinnedByCategory.get(node.group);
      if (!set) { set = new Set(); pinnedByCategory.set(node.group, set); }
      set.add(id);
    }
  }

  // Filter to active categories + pinned tags
  const tagNodes = new Map<string, RawNode>();
  for (const n of rawNodes) {
    if (n.group === 'doi') continue;
    if (!activeCategories.has(n.group as Category)) continue;
    const pinned = pinnedByCategory.get(n.group);
    if (pinned && !pinned.has(n.id)) continue;
    tagNodes.set(n.id, n);
  }

  // Count DOIs per tag
  const doiCountMap = new Map<string, number>();
  for (const [, tags] of doiToTags) {
    for (const t of tags) {
      if (tagNodes.has(t)) doiCountMap.set(t, (doiCountMap.get(t) || 0) + 1);
    }
  }

  // Build projected edges
  const edgeKey = (a: string, b: string) => a < b ? `${a}|||${b}` : `${b}|||${a}`;
  const edgeMap = new Map<string, { source: string; target: string; dois: Set<string> }>();

  for (const [doiId, tags] of doiToTags) {
    const visible = tags.filter(t => tagNodes.has(t));
    for (let i = 0; i < visible.length; i++) {
      for (let j = i + 1; j < visible.length; j++) {
        const key = edgeKey(visible[i], visible[j]);
        let entry = edgeMap.get(key);
        if (!entry) { entry = { source: visible[i], target: visible[j], dois: new Set() }; edgeMap.set(key, entry); }
        entry.dois.add(doiId);
      }
    }
  }

  const edges: ProjectedEdge[] = [...edgeMap.values()].map(e => ({
    source: e.source, target: e.target, weight: e.dois.size,
    sharedDois: [...e.dois].map(d => doiLabels.get(d) || d.replace('doi:', '')),
  }));

  // Compute degree and weight per tag
  const degreeMap = new Map<string, number>();
  const weightMap = new Map<string, number>();
  for (const e of edges) {
    degreeMap.set(e.source, (degreeMap.get(e.source) || 0) + 1);
    degreeMap.set(e.target, (degreeMap.get(e.target) || 0) + 1);
    weightMap.set(e.source, (weightMap.get(e.source) || 0) + e.weight);
    weightMap.set(e.target, (weightMap.get(e.target) || 0) + e.weight);
  }

  let baseNodes: TagNode[] = [...tagNodes.values()].map(n => ({
    id: n.id, label: n.label, group: n.group,
    doiCount: doiCountMap.get(n.id) || 0,
    degree: degreeMap.get(n.id) || 0,
    weight: weightMap.get(n.id) || 0,
  }));

  // Cap nodes: keep top N by weight
  if (baseNodes.length > MAX_NODES) {
    baseNodes.sort((a, b) => b.weight - a.weight);
    baseNodes = baseNodes.slice(0, MAX_NODES);
  }

  const keptIds = new Set(baseNodes.map(n => n.id));
  let cappedEdges = edges.filter(e => keptIds.has(e.source) && keptIds.has(e.target));

  // Cap edges: keep top N by weight
  if (cappedEdges.length > MAX_EDGES) {
    cappedEdges.sort((a, b) => b.weight - a.weight);
    cappedEdges = cappedEdges.slice(0, MAX_EDGES);
  }

  // Run Leiden community detection
  const communityMap = leiden(
    baseNodes.map(n => n.id),
    cappedEdges.map(e => ({ source: e.source, target: e.target, weight: e.weight })),
  );

  const nodes = classifyNodes(baseNodes, cappedEdges, baseNodes, communityMap);

  // Collect matching DOIs
  const matchingDois = new Set<string>();
  const pinnedCats = [...pinnedByCategory.keys()];
  for (const [doiId, tags] of doiToTags) {
    let matches = true;
    for (const cat of pinnedCats) {
      const pinSet = pinnedByCategory.get(cat)!;
      if (!tags.some(t => pinSet.has(t))) { matches = false; break; }
    }
    if (matches && tags.some(t => tagNodes.has(t))) {
      matchingDois.add(doiId.replace('doi:', ''));
    }
  }

  return { nodes, edges: cappedEdges, matchingDois };
}
