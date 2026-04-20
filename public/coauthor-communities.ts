import type { CoauthorNode } from './dashboard-builders.js';

export const COMMUNITY_PALETTE = ['#6ba4d6', '#b57ad1', '#8fcb9b', '#d68a6b', '#d1c57a', '#c67ad1', '#6bd6c5', '#d66b8a', '#7a8ed1'];
export const OTHER_KEY = '__other__';
export const OTHER_COLOR = '#b0b0b0';
export const OTHER_LABEL = 'Other institutions';

const MIN_COMMUNITY_SIZE = 3;

/** Which RORs have enough co-authors to be their own community. The home ROR
 *  always qualifies so the principal's own institution gets a visible area. */
export function majorRors(nodes: CoauthorNode[], myRor: string | null): Set<string> {
  const counts = new Map<string, number>();
  for (const n of nodes) {
    if (n.isMe || !n.affiliation?.ror) continue;
    counts.set(n.affiliation.ror, (counts.get(n.affiliation.ror) || 0) + 1);
  }
  const set = new Set<string>();
  for (const [ror, count] of counts) {
    if (count >= MIN_COMMUNITY_SIZE) set.add(ror);
  }
  if (myRor) set.add(myRor);
  return set;
}

/** Community key for a node: its ROR if major (including home), '__other__' if
 *  minor/missing, null only for the ego (which is the visual anchor, not a node). */
export function communityKeyFor(n: CoauthorNode, myRor: string | null, major: Set<string>): string | null {
  if (n.isMe) return null;
  const ror = n.affiliation?.ror;
  if (ror && major.has(ror)) return ror;
  return OTHER_KEY;
}

export function buildCommunityColors(nodes: CoauthorNode[], myRor: string | null): Map<string, string> {
  const major = majorRors(nodes, myRor);
  const external = [...major].filter(ror => ror !== myRor).sort((a, b) => {
    const ca = nodes.filter(n => n.affiliation?.ror === a).length;
    const cb = nodes.filter(n => n.affiliation?.ror === b).length;
    return cb - ca;
  });
  const map = new Map<string, string>();
  external.forEach((ror, i) => map.set(ror, COMMUNITY_PALETTE[i % COMMUNITY_PALETTE.length]));
  if (myRor) map.set(myRor, 'var(--accent)');
  map.set(OTHER_KEY, OTHER_COLOR);
  return map;
}
