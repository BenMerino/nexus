import { shortestPath } from './connected-set';

type Link = { source: string | { id: string }; target: string | { id: string } };

function idOf(endpoint: string | { id: string }): string {
  return typeof endpoint === 'object' ? endpoint.id : endpoint;
}

/** Same rule for hover and click: light up every relationship the focused
 *  node has — all its 1-hop neighbors — *and* the shortest path back to
 *  the ego so the anchor to the user stays visible. Returns null when
 *  nothing is focused. */
export function buildFocusSet(
  hoverId: string | null | undefined,
  selectedId: string | null | undefined,
  egoId: string | null,
  links: Link[],
): Set<string> | null {
  const focusId = hoverId || selectedId;
  if (!focusId) return null;
  const set = new Set<string>([focusId]);
  for (const l of links) {
    const s = idOf(l.source);
    const t = idOf(l.target);
    if (s === focusId) set.add(t);
    if (t === focusId) set.add(s);
  }
  if (egoId && egoId !== focusId) {
    const path = shortestPath(focusId, egoId, links);
    if (path) for (const id of path) set.add(id);
  }
  return set;
}
