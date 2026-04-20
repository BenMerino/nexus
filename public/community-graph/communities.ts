import type { CommunityAdapter } from './types';

export const COMMUNITY_PALETTE = ['#6ba4d6', '#b57ad1', '#8fcb9b', '#d68a6b', '#d1c57a', '#c67ad1', '#6bd6c5', '#d66b8a', '#7a8ed1'];
export const OTHER_KEY = '__other__';
export const OTHER_COLOR = '#b0b0b0';
export const OTHER_LABEL = 'Other';

/** Which community keys have enough members to be their own community. The
 *  primary key always qualifies so the ego's own community gets a visible area. */
export function majorCommunities<N>(
  nodes: N[],
  adapter: CommunityAdapter<N>,
  primaryKey: string | null,
  minSize: number,
): Set<string> {
  const counts = new Map<string, number>();
  for (const n of nodes) {
    if (adapter.isEgo(n)) continue;
    const key = adapter.getCommunityKey(n);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const set = new Set<string>();
  for (const [key, count] of counts) {
    if (count >= minSize) set.add(key);
  }
  if (primaryKey) set.add(primaryKey);
  return set;
}

/** Effective community key for a node: its own key if major, otherwise OTHER_KEY.
 *  Ego nodes return null (they're anchors, not community members). */
export function effectiveKey<N>(
  n: N,
  adapter: CommunityAdapter<N>,
  major: Set<string>,
): string | null {
  if (adapter.isEgo(n)) return null;
  const key = adapter.getCommunityKey(n);
  if (key && major.has(key)) return key;
  if (key === null) return null;
  return OTHER_KEY;
}

export function buildCommunityColors<N>(
  nodes: N[],
  adapter: CommunityAdapter<N>,
  primaryKey: string | null,
  minSize: number,
): Map<string, string> {
  const major = majorCommunities(nodes, adapter, primaryKey, minSize);
  const counts = new Map<string, number>();
  for (const n of nodes) {
    const k = adapter.getCommunityKey(n);
    if (k) counts.set(k, (counts.get(k) || 0) + 1);
  }
  const external = [...major]
    .filter(k => k !== primaryKey)
    .sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0));
  const map = new Map<string, string>();
  external.forEach((key, i) => map.set(key, COMMUNITY_PALETTE[i % COMMUNITY_PALETTE.length]));
  if (primaryKey) map.set(primaryKey, 'var(--accent)');
  map.set(OTHER_KEY, OTHER_COLOR);
  return map;
}
