import { shortestPath } from './connected-set';

type Link = { source: string | { id: string }; target: string | { id: string } };

/** One rule for hover and click alike: highlight the shortest path from the
 *  focused node back to the ego. Every relationship runs through or ends at
 *  the ego, so that chain is the relationship worth seeing. Returns null
 *  when nothing is focused. */
export function buildFocusSet(
  hoverId: string | null | undefined,
  selectedId: string | null | undefined,
  egoId: string | null,
  links: Link[],
): Set<string> | null {
  const focusId = hoverId || selectedId;
  if (!focusId) return null;
  if (!egoId || focusId === egoId) return new Set([focusId]);
  const path = shortestPath(focusId, egoId, links);
  if (!path) return new Set([focusId]);
  return new Set(path);
}
