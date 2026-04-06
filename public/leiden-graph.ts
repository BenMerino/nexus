/** Graph primitives for the Leiden community detection algorithm. */

export interface LeidenEdge { source: string; target: string; weight: number }
export type Community = Map<string, number>;

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

/** Deterministic shuffle using seed derived from node IDs */
export function deterministicShuffle(arr: string[]): string[] {
  const out = [...arr];
  let seed = 0;
  for (const s of out) for (let i = 0; i < s.length; i++) seed = (seed * 31 + s.charCodeAt(i)) | 0;
  for (let i = out.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) | 0;
    const j = ((seed >>> 0) % (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Modularity gain of moving nodeId into targetComm (node already removed from its comm) */
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

/** Aggregate communities into a super-graph. Returns super-node → original members. */
export function aggregate(
  nodeIds: string[], edges: LeidenEdge[], comm: Community,
): { superIds: string[]; superEdges: LeidenEdge[]; members: Map<string, string[]> } {
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

  const members = new Map<string, string[]>();
  for (const [c, ids] of commNodes) members.set(String(c), ids);
  return { superIds, superEdges, members };
}
