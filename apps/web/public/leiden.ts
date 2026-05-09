/**
 * Leiden community detection (Traag, Waltman, van Eck 2019).
 * Key difference from Louvain: refinement phase guarantees γ-connected communities
 * by only merging well-connected nodes within each flat community.
 */

import type { LeidenEdge, Community } from './leiden-graph';
import {
  totalWeight, adjacency, nodeDegrees, deterministicShuffle,
  modularityGain, buildCommTotals, moveNodesFast, aggregate,
} from './leiden-graph';

/**
 * Phase 2: Leiden refinement.
 * Within each flat community, nodes start as singletons.
 * A node merges into a neighbor's refined-community only if:
 *   (a) that community is a subset of the same flat community
 *   (b) the modularity gain is positive
 *   (c) the node is well-connected: internal weight ≥ γ·k_v·(|C|-1)/(2m)
 */
function refinePartition(
  nodeIds: string[], flat: Community,
  adj: Map<string, { neighbor: string; weight: number }[]>,
  deg: Map<string, number>, m: number, res: number,
): Community {
  const refined: Community = new Map();
  let nextId = 0;
  for (const id of nodeIds) refined.set(id, nextId++);

  const byFlat = new Map<number, string[]>();
  for (const id of nodeIds) {
    const c = flat.get(id)!;
    const arr = byFlat.get(c) || [];
    arr.push(id);
    byFlat.set(c, arr);
  }

  for (const [, members] of byFlat) {
    if (members.length <= 1) continue;
    const mSet = new Set(members);

    for (const v of deterministicShuffle(members, 7)) {
      // Skip if already merged (no longer a singleton in refined)
      const vComm = refined.get(v)!;
      if (members.some(u => u !== v && refined.get(u) === vComm)) continue;

      // Well-connected check: internal weight within this flat community
      let intW = 0;
      for (const { neighbor, weight } of adj.get(v) || []) {
        if (mSet.has(neighbor)) intW += weight;
      }
      const kv = deg.get(v) || 0;
      if (intW < res * kv * (members.length - 1) / (2 * m)) continue;

      // Find best refined community among same-flat neighbors
      const ct = buildCommTotals(members, refined, deg);
      ct.set(vComm, (ct.get(vComm) || 0) - kv);
      let bestComm = vComm, bestGain = 0;
      const seen = new Set<number>();
      for (const { neighbor } of adj.get(v) || []) {
        if (!mSet.has(neighbor)) continue;
        const nc = refined.get(neighbor)!;
        if (nc === vComm || seen.has(nc)) continue;
        seen.add(nc);
        const g = modularityGain(v, nc, refined, adj, deg, ct, m, res);
        if (g > bestGain) { bestGain = g; bestComm = nc; }
      }
      if (bestComm !== vComm) refined.set(v, bestComm);
    }
  }
  return refined;
}

/** Run Leiden. Returns nodeId → communityId (0-indexed). */
export function leiden(
  nodeIds: string[], edges: LeidenEdge[], resolution = 1.0, maxIter = 10,
): Map<string, number> {
  if (!nodeIds.length || !edges.length) {
    return new Map(nodeIds.map((id, i) => [id, i]));
  }
  const m = totalWeight(edges);
  if (m === 0) return new Map(nodeIds.map((id, i) => [id, i]));

  let superToOrig = new Map<string, string[]>(nodeIds.map(id => [id, [id]]));
  let curIds = [...nodeIds];
  let curEdges = [...edges];

  for (let iter = 0; iter < maxIter; iter++) {
    const flat: Community = new Map(curIds.map((id, i) => [id, i]));
    const adj = adjacency(curIds, curEdges);
    const deg = nodeDegrees(curIds, curEdges);

    if (!moveNodesFast(curIds, flat, adj, deg, m, resolution)) break;
    const refined = refinePartition(curIds, flat, adj, deg, m, resolution);

    const { superIds, superEdges, members } = aggregate(curIds, curEdges, refined);
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
    for (const orig of originals) result.set(orig, cid);
    cid++;
  }
  return result;
}
