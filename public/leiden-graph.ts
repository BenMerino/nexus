/** Graph primitives used by the Leiden community detection algorithm. */

export interface LeidenEdge { source: string; target: string; weight: number }
export type Community = Map<string, number>; // nodeId → communityId

export function totalWeight(edges: LeidenEdge[]): number {
  return edges.reduce((s, e) => s + e.weight, 0);
}

export function adjacency(nodeIds: string[], edges: LeidenEdge[]) {
  const adj = new Map<string, { neighbor: string; weight: number }[]>();
  for (const id of nodeIds) adj.set(id, []);
  for (const e of edges) {
    adj.get(e.source)?.push({ neighbor: e.target, weight: e.weight });
    adj.get(e.target)?.push({ neighbor: e.source, weight: e.weight });
  }
  return adj;
}

export function nodeDegrees(nodeIds: string[], edges: LeidenEdge[]): Map<string, number> {
  const deg = new Map<string, number>();
  for (const id of nodeIds) deg.set(id, 0);
  for (const e of edges) {
    deg.set(e.source, (deg.get(e.source) || 0) + e.weight);
    deg.set(e.target, (deg.get(e.target) || 0) + e.weight);
  }
  return deg;
}

export function modularityGain(
  nodeId: string, targetComm: number, comm: Community,
  adj: Map<string, { neighbor: string; weight: number }[]>,
  deg: Map<string, number>, commTotals: Map<number, number>,
  m: number, resolution: number,
): number {
  let kIn = 0;
  for (const { neighbor, weight } of adj.get(nodeId) || []) {
    if (comm.get(neighbor) === targetComm) kIn += weight;
  }
  const ki = deg.get(nodeId) || 0;
  const sigTot = commTotals.get(targetComm) || 0;
  return kIn / m - resolution * (sigTot * ki) / (2 * m * m);
}

/** Local moving phase: greedily move nodes to best neighbor community */
export function localMove(
  nodeIds: string[], comm: Community,
  adj: Map<string, { neighbor: string; weight: number }[]>,
  deg: Map<string, number>, m: number, resolution: number,
): boolean {
  const commTotals = new Map<number, number>();
  for (const id of nodeIds) {
    const c = comm.get(id)!;
    commTotals.set(c, (commTotals.get(c) || 0) + (deg.get(id) || 0));
  }

  let improved = false;
  const shuffled = [...nodeIds].sort(() => Math.random() - 0.5);

  for (const nodeId of shuffled) {
    const currentComm = comm.get(nodeId)!;
    const ki = deg.get(nodeId) || 0;
    commTotals.set(currentComm, (commTotals.get(currentComm) || 0) - ki);

    const loss = -modularityGain(nodeId, currentComm, comm, adj, deg, commTotals, m, resolution);
    let bestComm = currentComm;
    let bestGain = 0;
    const neighborComms = new Set<number>();
    for (const { neighbor } of adj.get(nodeId) || []) neighborComms.add(comm.get(neighbor)!);

    for (const nc of neighborComms) {
      if (nc === currentComm) continue;
      const gain = modularityGain(nodeId, nc, comm, adj, deg, commTotals, m, resolution) + loss;
      if (gain > bestGain) { bestGain = gain; bestComm = nc; }
    }

    comm.set(nodeId, bestComm);
    commTotals.set(bestComm, (commTotals.get(bestComm) || 0) + ki);
    if (bestComm !== currentComm) improved = true;
  }
  return improved;
}

/** Aggregate graph: merge communities into super-nodes */
export function aggregate(
  nodeIds: string[], edges: LeidenEdge[], comm: Community,
): { nodeIds: string[]; edges: LeidenEdge[]; mapping: Map<string, string[]> } {
  const commNodes = new Map<number, string[]>();
  for (const id of nodeIds) {
    const c = comm.get(id)!;
    const arr = commNodes.get(c) || [];
    arr.push(id);
    commNodes.set(c, arr);
  }

  const superIds = [...commNodes.keys()].map(String);
  const edgeMap = new Map<string, number>();
  for (const e of edges) {
    const sc = String(comm.get(e.source)!);
    const tc = String(comm.get(e.target)!);
    if (sc === tc) continue;
    const key = sc < tc ? `${sc}|||${tc}` : `${tc}|||${sc}`;
    edgeMap.set(key, (edgeMap.get(key) || 0) + e.weight);
  }

  const superEdges: LeidenEdge[] = [...edgeMap.entries()].map(([key, weight]) => {
    const [source, target] = key.split('|||');
    return { source, target, weight };
  });

  const mapping = new Map<string, string[]>();
  for (const [c, ids] of commNodes) mapping.set(String(c), ids);
  return { nodeIds: superIds, edges: superEdges, mapping };
}
