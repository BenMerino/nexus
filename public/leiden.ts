/**
 * Leiden community detection algorithm.
 * Finds densely-connected communities by optimizing modularity.
 */

import type { LeidenEdge, Community } from './leiden-graph';
import { totalWeight, adjacency, nodeDegrees, localMove, aggregate } from './leiden-graph';

/**
 * Run Leiden algorithm. Returns a map of nodeId → communityId.
 * @param resolution Higher = more smaller communities (default 1.0)
 * @param maxIterations Safety cap on outer iterations
 */
export function leiden(
  nodeIds: string[], edges: LeidenEdge[], resolution = 1.0, maxIterations = 10,
): Map<string, number> {
  if (!nodeIds.length || !edges.length) {
    const result = new Map<string, number>();
    nodeIds.forEach((id, i) => result.set(id, i));
    return result;
  }

  const m = totalWeight(edges);
  if (m === 0) {
    const result = new Map<string, number>();
    nodeIds.forEach((id, i) => result.set(id, i));
    return result;
  }

  let currentIds = [...nodeIds];
  let currentEdges = [...edges];
  const globalComm = new Map<string, number>();
  nodeIds.forEach((id, i) => globalComm.set(id, i));
  let nextCommId = nodeIds.length;

  for (let iter = 0; iter < maxIterations; iter++) {
    const comm: Community = new Map();
    currentIds.forEach((id, i) => comm.set(id, i));

    const adj = adjacency(currentIds, currentEdges);
    const deg = nodeDegrees(currentIds, currentEdges);
    const currentM = totalWeight(currentEdges) || m;

    const moved = localMove(currentIds, comm, adj, deg, currentM, resolution);
    if (!moved) break;

    const { nodeIds: superIds, edges: superEdges, mapping } = aggregate(currentIds, currentEdges, comm);
    if (superIds.length === currentIds.length) break;

    // Update global community assignments
    for (const [, members] of mapping) {
      const cid = nextCommId++;
      for (const member of members) {
        if (globalComm.has(member)) {
          globalComm.set(member, cid);
        } else {
          for (const [origId, origComm] of globalComm) {
            if (String(origComm) === member) globalComm.set(origId, cid);
          }
        }
      }
    }

    currentIds = superIds;
    currentEdges = superEdges;
  }

  // Compact community IDs to 0..N-1
  const uniqueComms = [...new Set(globalComm.values())];
  const remap = new Map(uniqueComms.map((c, i) => [c, i]));
  const result = new Map<string, number>();
  for (const [id, c] of globalComm) result.set(id, remap.get(c)!);
  return result;
}
