/** All node ids reachable from `focusId` in one hop along `links`, plus the
 *  focus itself. Returns null when there's no focus — callers treat that as
 *  "no neighbor highlighting active." */
export function connectedSet(
  focusId: string | null | undefined,
  links: { source: string | { id: string }; target: string | { id: string } }[],
): Set<string> | null {
  if (!focusId) return null;
  const set = new Set<string>([focusId]);
  for (const l of links) {
    const s = typeof l.source === 'object' ? l.source.id : l.source;
    const t = typeof l.target === 'object' ? l.target.id : l.target;
    if (s === focusId) set.add(t);
    if (t === focusId) set.add(s);
  }
  return set;
}
