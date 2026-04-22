import { connectedSet, shortestPath } from './connected-set';

type Link = { source: string | { id: string }; target: string | { id: string } };

/** Build the highlight set for a hover or selection:
 *  - Hover: the hovered node's immediate neighbors, plus the shortest path
 *    back to the ego so the tie that anchors it to the user stays lit.
 *  - Select: the full 3-hop reachable subgraph so paths *through* the
 *    selected node remain visible.
 *  Returns null when neither hover nor select is active. */
export function buildFocusSet(
  hoverId: string | null | undefined,
  selectedId: string | null | undefined,
  egoId: string | null,
  links: Link[],
): Set<string> | null {
  if (hoverId) {
    const set = connectedSet(hoverId, links, 1) ?? new Set([hoverId]);
    if (egoId && egoId !== hoverId) {
      const path = shortestPath(hoverId, egoId, links);
      if (path) for (const id of path) set.add(id);
    }
    return set;
  }
  if (selectedId) return connectedSet(selectedId, links, 3);
  return null;
}
