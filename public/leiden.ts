/**
 * Leiden community detection algorithm (Traag, Waltman, van Eck 2019).
 * Improves on Louvain with a refinement phase that guarantees well-connected communities.
 */

import type { LeidenEdge, Community } from './leiden-graph';
import {
  totalWeight, adjacency, nodeDegrees, deterministicShuffle,
  modularityGain, aggregate,
} from './leiden-graph';

/** Local moving: iterate until no node improves modularity */
function localMove(
  nodeIds: string[], comm: Community,
  adj: Map<string, { neighbor: string; weight: number }[]>,
  deg: Map<string, number>, m: number, res: number,
): boolean {
  const commTotals = new Map<number, number>();
  for (const id of nodeIds) {
    const c = comm.get(id)!;
    commTotals.set(c, (commTotals.get(c) || 0) + (deg.get(id) || 0));
  }
  let anyMoved = false;
  const order = deterministicShuffle(nodeIds);
  for (let pass = 0; pass < 10; pass++) {
    let moved = false;
    for (const nodeId of order) {
      const cur = comm.get(nodeId)!;
      const ki = deg.get(nodeId) || 0;
      commTotals.set(cur, (commTotals.get(cur) || 0) - ki);
      const loss = -modularityGain(nodeId, cur, comm, adj, deg, commTotals, m, res);
      let bestComm = cur, bestGain = 0;
      const seen = new Set<number>();
      for (const { neighbor } of adj.get(nodeId) || []) {
        const nc = comm.get(neighbor)!;
        if (nc === cur || seen.has(nc)) continue;
        seen.add(nc);
        const g = modularityGain(nodeId, nc, comm, adj, deg, commTotals, m, res) + loss;
        if (g > bestGain) { bestGain = g; bestComm = nc; }
      }
      comm.set(nodeId, bestComm);
      commTotals.set(bestComm, (commTotals.get(bestComm) || 0) + ki);
      if (bestComm !== cur) moved = true;
    }
    if (!moved) break;
    anyMoved = true;
  }
  return anyMoved;
}

/** Leiden refinement: within each community, split into well-connected subcommunities */
function refine(
  nodeIds: string[], comm: Community,
  adj: Map<string, { neighbor: string; weight: number }[]>,
  m: number, res: number,
): void {
  const refined: Community = new Map();
  let nextId = 0;
  for (const id of nodeIds) refined.set(id, nextId++);

  const byCommunity = new Map<number, string[]>();
  for (const id of nodeIds) {
    const c = comm.get(id)!;
    const arr = byCommunity.get(c) || [];
    arr.push(id);
    byCommunity.set(c, arr);
  }

  for (const [, members] of byCommunity) {
    if (members.length <= 2) {
      const cid = refined.get(members[0])!;
      for (const id of members) refined.set(id, cid);
      continue;
    }
    const memberSet = new Set(members);
    const subAdj = new Map<string, { neighbor: string; weight: number }[]>();
    for (const id of members) {
      subAdj.set(id, (adj.get(id) || []).filter(e => memberSet.has(e.neighbor)));
    }
    const subDeg = new Map<string, number>();
    for (const id of members) {
      let d = 0;
      for (const { weight } of subAdj.get(id) || []) d += weight;
      subDeg.set(id, d);
    }
    localMove(members, refined, subAdj, subDeg, m, res);
  }

  for (const [id, c] of refined) comm.set(id, c);
}

/** Adaptive resolution: higher for denser graphs (bipartite projections are dense) */
function adaptiveResolution(nodeCount: number, edgeCount: number): number {
  if (nodeCount <= 2) return 1.0;
  const maxEdges = (nodeCount * (nodeCount - 1)) / 2;
  const density = edgeCount / maxEdges;
  return Math.max(1.0, 1.0 + 4 * density);
}

/** Run Leiden. Returns nodeId → communityId (0-indexed). */
export function leiden(
  nodeIds: string[], edges: LeidenEdge[], maxIter = 10,
): Map<string, number> {
  if (!nodeIds.length || !edges.length) {
    return new Map(nodeIds.map((id, i) => [id, i]));
  }
  const m = totalWeight(edges);
  if (m === 0) return new Map(nodeIds.map((id, i) => [id, i]));

  const resolution = adaptiveResolution(nodeIds.length, edges.length);
  let superToOrig = new Map<string, string[]>(nodeIds.map(id => [id, [id]]));
  let curIds = [...nodeIds];
  let curEdges = [...edges];

  for (let iter = 0; iter < maxIter; iter++) {
    const comm: Community = new Map(curIds.map((id, i) => [id, i]));
    const adj = adjacency(curIds, curEdges);
    const deg = nodeDegrees(curIds, curEdges);

    // Always use original m — aggregation drops intra-community edges
    if (!localMove(curIds, comm, adj, deg, m, resolution)) break;
    refine(curIds, comm, adj, m, resolution);

    const { superIds, superEdges, members } = aggregate(curIds, curEdges, comm);
    if (superIds.length >= curIds.length) break;

    const newSTO = new Map<string, string[]>();
    for (const [superId, subNodes] of members) {
      const originals: string[] = [];
      for (const sub of subNodes) originals.push(...(superToOrig.get(sub) || [sub]));
      newSTO.set(superId, originals);
    }
    superToOrig = newSTO;
    curIds = superIds;
    curEdges = superEdges;
  }

  const result = new Map<string, number>();
  let cid = 0;
  for (const [, originals] of superToOrig) {
    const id = cid++;
    for (const orig of originals) result.set(orig, id);
  }
  return result;
}
