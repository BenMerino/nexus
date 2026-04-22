export interface OverlayEdge { source: string; target: string }

/** Build "full triangle" overlay edges around a focused node. Given the
 *  focus's 1-hop neighbors (`connected`) and a co-occurrence map, return an
 *  edge for every pair of neighbors that also co-occur — i.e. the sides of
 *  the triangle that don't touch the focus itself. Pairs already present in
 *  the base graph are excluded so the overlay only adds new edges. */
export function buildOverlay(
  focusId: string | null,
  connected: Set<string> | null,
  coTags: Map<string, Set<string>> | undefined,
  visibleIds: Set<string>,
  baseEdges: { source: string | { id: string }; target: string | { id: string } }[],
): OverlayEdge[] {
  if (!focusId || !connected || !coTags) return [];

  const basePairs = new Set<string>();
  for (const e of baseEdges) {
    const s = typeof e.source === 'object' ? e.source.id : e.source;
    const t = typeof e.target === 'object' ? e.target.id : e.target;
    basePairs.add(s < t ? `${s}|${t}` : `${t}|${s}`);
  }

  const neighbors = [...connected].filter(id => id !== focusId && visibleIds.has(id));
  const out: OverlayEdge[] = [];
  for (let i = 0; i < neighbors.length; i++) {
    const a = neighbors[i];
    const sa = coTags.get(a);
    if (!sa) continue;
    for (let j = i + 1; j < neighbors.length; j++) {
      const b = neighbors[j];
      if (!sa.has(b)) continue;
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (basePairs.has(key)) continue;
      out.push({ source: a, target: b });
    }
  }
  return out;
}
