import type { TagNode, ProjectedEdge, EnrichedTagNode, NodeRole, CategoryProfileEntry } from './relationship-types';

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.ceil(p * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export function classifyNodes(
  nodes: TagNode[],
  edges: ProjectedEdge[],
  allNodes: TagNode[],
  communityMap?: Map<string, number>,
): EnrichedTagNode[] {
  const nodeById = new Map(allNodes.map(n => [n.id, n]));

  // Build category profile per node: how much weight connects to each category
  const profileMap = new Map<string, Map<string, number>>();
  for (const e of edges) {
    const sNode = nodeById.get(e.source);
    const tNode = nodeById.get(e.target);
    if (!sNode || !tNode) continue;

    const sMap = profileMap.get(e.source) || new Map();
    sMap.set(tNode.group, (sMap.get(tNode.group) || 0) + e.weight);
    profileMap.set(e.source, sMap);

    const tMap = profileMap.get(e.target) || new Map();
    tMap.set(sNode.group, (tMap.get(sNode.group) || 0) + e.weight);
    profileMap.set(e.target, tMap);
  }

  // Compute percentile thresholds
  const degrees = nodes.map(n => n.degree).sort((a, b) => a - b);
  const weights = nodes.map(n => n.weight).sort((a, b) => a - b);
  const degP75 = percentile(degrees, 0.75);
  const degMedian = percentile(degrees, 0.5);
  const weightP75 = percentile(weights, 0.75);

  // Avg weight per edge
  const avgWeights = nodes
    .filter(n => n.degree > 0)
    .map(n => n.weight / n.degree)
    .sort((a, b) => a - b);
  const avgWtMedian = percentile(avgWeights, 0.5);

  return nodes.map(n => {
    let role: NodeRole = 'default';
    if (n.degree <= 2) {
      role = 'leaf';
    } else if (n.degree >= degP75 && n.weight >= weightP75) {
      role = 'hub';
    } else if (n.degree >= degMedian && n.degree > 0 && (n.weight / n.degree) < avgWtMedian) {
      role = 'bridge';
    }

    const catMap = profileMap.get(n.id) || new Map();
    const categoryProfile: CategoryProfileEntry[] = [...catMap.entries()]
      .map(([category, weight]) => ({ category, weight }))
      .sort((a, b) => b.weight - a.weight);

    const community = communityMap?.get(n.id) ?? 0;
    return { ...n, role, community, categoryProfile };
  });
}
