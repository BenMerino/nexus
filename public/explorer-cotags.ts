import type { RawEdge } from './relationship-types';

/** For each tag id, the set of tags it co-occurs with in at least one DOI.
 *  Used to draw the "full triangle" overlay when a node is focused — the
 *  focused node's 1-hop neighbors that also share a DOI with each other
 *  get connected by an overlay edge. */
export function buildCoTagMap(rawEdges: RawEdge[]): Map<string, Set<string>> {
  const tagsByDoi = new Map<string, string[]>();
  for (const e of rawEdges) {
    const list = tagsByDoi.get(e.source);
    if (list) list.push(e.target);
    else tagsByDoi.set(e.source, [e.target]);
  }
  const coTags = new Map<string, Set<string>>();
  for (const tags of tagsByDoi.values()) {
    for (let i = 0; i < tags.length; i++) {
      for (let j = i + 1; j < tags.length; j++) {
        const a = tags[i], b = tags[j];
        let sa = coTags.get(a);
        if (!sa) { sa = new Set(); coTags.set(a, sa); }
        sa.add(b);
        let sb = coTags.get(b);
        if (!sb) { sb = new Set(); coTags.set(b, sb); }
        sb.add(a);
      }
    }
  }
  return coTags;
}
