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
    if (e.source === e.target) continue; // skip self-loops in adjacency
    adj.get(e.source)?.push({ neighbor: e.target, weight: e.weight });
    adj.get(e.target)?.push({ neighbor: e.source, weight: e.weight });
  }
  return adj;
}

/** Weighted degree including self-loop weight (counted twice per convention) */
export function nodeDegrees(nodeIds: string[], edges: LeidenEdge[]): Map<string, number> {
  const deg = new Map<string, number>();
  for (const id of nodeIds) deg.set(id, 0);
  for (const e of edges) {
    if (e.source === e.target) {
      deg.set(e.source, (deg.get(e.source) || 0) + 2 * e.weight);
    } else {
      deg.set(e.source, (deg.get(e.source) || 0) + e.weight);
      deg.set(e.target, (deg.get(e.target) || 0) + e.weight);
    }
  }
  return deg;
}

/** Deterministic shuffle seeded from node IDs + salt */
export function deterministicShuffle(arr: string[], salt = 0): string[] {
  const out = [...arr];
  let seed = salt;
  for (const s of out) for (let i = 0; i < s.length; i++) seed = (seed * 31 + s.charCodeAt(i)) | 0;
  for (let i = out.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) | 0;
    const j = ((seed >>> 0) % (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Modularity gain of moving nodeId into targetComm (node already removed) */
export function modularityGain(
  nodeId: string, targetComm: number, comm: Community,
  adj: Map<string, { neighbor: string; weight: number }[]>,
  deg: Map<string, number>, ct: Map<number, number>,
  m: number, res: number,
): number {
  let kIn = 0;
  for (const { neighbor, weight } of adj.get(nodeId) || []) {
    if (comm.get(neighbor) === targetComm) kIn += weight;
  }
  const ki = deg.get(nodeId) || 0;
  const sigTot = ct.get(targetComm) || 0;
  return kIn / m - res * (sigTot * ki) / (2 * m * m);
}

export function buildCommTotals(
  nodeIds: string[], comm: Community, deg: Map<string, number>,
): Map<number, number> {
  const ct = new Map<number, number>();
  for (const id of nodeIds) {
    const c = comm.get(id)!;
    ct.set(c, (ct.get(c) || 0) + (deg.get(id) || 0));
  }
  return ct;
}

/** Phase 1: local moving */
export function moveNodesFast(
  nodeIds: string[], comm: Community,
  adj: Map<string, { neighbor: string; weight: number }[]>,
  deg: Map<string, number>, m: number, res: number,
): boolean {
  const ct = buildCommTotals(nodeIds, comm, deg);
  let anyMoved = false;
  const order = deterministicShuffle(nodeIds, 42);
  for (let pass = 0; pass < 10; pass++) {
    let moved = false;
    for (const v of order) {
      const cur = comm.get(v)!;
      const kv = deg.get(v) || 0;
      ct.set(cur, (ct.get(cur) || 0) - kv);
      const loss = -modularityGain(v, cur, comm, adj, deg, ct, m, res);
      let best = cur, bestG = 0;
      const seen = new Set<number>();
      for (const { neighbor } of adj.get(v) || []) {
        const nc = comm.get(neighbor)!;
        if (nc === cur || seen.has(nc)) continue;
        seen.add(nc);
        const g = modularityGain(v, nc, comm, adj, deg, ct, m, res) + loss;
        if (g > bestG) { bestG = g; best = nc; }
      }
      comm.set(v, best);
      ct.set(best, (ct.get(best) || 0) + kv);
      if (best !== cur) moved = true;
    }
    if (!moved) break;
    anyMoved = true;
  }
  return anyMoved;
}

/** Aggregate with self-loops to preserve total weight across levels */
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
    const key = sc === tc ? `${sc}|||${sc}` : (sc < tc ? `${sc}|||${tc}` : `${tc}|||${sc}`);
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
