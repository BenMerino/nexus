import type { RawEdge } from './relationship-types';

/** Returns the set of author node ids that share at least one DOI with the
 *  ego author. The ego itself is not included. */
export function buildCoauthorSet(rawEdges: RawEdge[], egoAuthorId: string | null): Set<string> {
  const out = new Set<string>();
  if (!egoAuthorId) return out;

  const authorsByDoi = new Map<string, string[]>();
  for (const e of rawEdges) {
    if (!e.target.startsWith('author:')) continue;
    const list = authorsByDoi.get(e.source);
    if (list) list.push(e.target);
    else authorsByDoi.set(e.source, [e.target]);
  }

  for (const authors of authorsByDoi.values()) {
    if (!authors.includes(egoAuthorId)) continue;
    for (const a of authors) if (a !== egoAuthorId) out.add(a);
  }
  return out;
}
