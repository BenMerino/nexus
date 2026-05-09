type Link = { source: string | { id: string }; target: string | { id: string } };

function idOf(endpoint: string | { id: string }): string {
  return typeof endpoint === 'object' ? endpoint.id : endpoint;
}

/** BFS the shortest path between two node ids. Returns the ordered node
 *  sequence (inclusive of both endpoints) or null if no path exists.
 *  Used to trace the route from a focused node back to the ego — every
 *  relationship in this graph passes through or ends at the ego, so that
 *  chain is the one worth highlighting. */
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
