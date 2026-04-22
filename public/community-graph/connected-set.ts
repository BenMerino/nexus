type Link = { source: string | { id: string }; target: string | { id: string } };

function idOf(endpoint: string | { id: string }): string {
  return typeof endpoint === 'object' ? endpoint.id : endpoint;
}

/** All node ids reachable from `focusId` within `maxHops` steps along
 *  `links`, plus the focus itself. Returns null when there's no focus —
 *  callers treat that as "no neighbor highlighting active."
 *
 *  maxHops = 1 highlights just immediate neighbors (cheap for hover).
 *  Higher values pull in the transitive subgraph so paths that pass
 *  through the focused node stay visible (useful for selection). */
export function connectedSet(
  focusId: string | null | undefined,
  links: Link[],
  maxHops = 1,
): Set<string> | null {
  if (!focusId) return null;
  if (maxHops <= 0) return new Set([focusId]);

  const adjacency = new Map<string, string[]>();
  for (const l of links) {
    const s = idOf(l.source);
    const t = idOf(l.target);
    const sn = adjacency.get(s) ?? []; sn.push(t); adjacency.set(s, sn);
    const tn = adjacency.get(t) ?? []; tn.push(s); adjacency.set(t, tn);
  }

  const set = new Set<string>([focusId]);
  let frontier: string[] = [focusId];
  for (let hop = 0; hop < maxHops; hop++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const nb of adjacency.get(id) ?? []) {
        if (!set.has(nb)) { set.add(nb); next.push(nb); }
      }
    }
    if (next.length === 0) break;
    frontier = next;
  }
  return set;
}

/** BFS the shortest path between two node ids. Returns the ordered node
 *  sequence (inclusive of both endpoints) or null if no path exists.
 *  Used to trace the route from a hovered node back to the ego so the
 *  connecting chain stays lit even when it's more than one hop away. */
export function shortestPath(
  fromId: string,
  toId: string,
  links: Link[],
): string[] | null {
  if (fromId === toId) return [fromId];
  const adjacency = new Map<string, string[]>();
  for (const l of links) {
    const s = idOf(l.source);
    const t = idOf(l.target);
    const sn = adjacency.get(s) ?? []; sn.push(t); adjacency.set(s, sn);
    const tn = adjacency.get(t) ?? []; tn.push(s); adjacency.set(t, tn);
  }
  const parent = new Map<string, string>();
  const queue: string[] = [fromId];
  const seen = new Set<string>([fromId]);
  while (queue.length) {
    const id = queue.shift()!;
    if (id === toId) {
      const path: string[] = [];
      let cur: string | undefined = id;
      while (cur !== undefined) { path.push(cur); cur = parent.get(cur); }
      return path.reverse();
    }
    for (const nb of adjacency.get(id) ?? []) {
      if (seen.has(nb)) continue;
      seen.add(nb); parent.set(nb, id); queue.push(nb);
    }
  }
  return null;
}
