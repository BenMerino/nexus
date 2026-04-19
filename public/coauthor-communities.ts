import type { CoauthorNode } from './dashboard-builders.js';

export const COMMUNITY_PALETTE = ['#6ba4d6', '#b57ad1', '#8fcb9b', '#d68a6b', '#d1c57a', '#c67ad1', '#6bd6c5', '#d66b8a', '#7a8ed1', '#b0b0b0'];

export function buildCommunityColors(nodes: CoauthorNode[], myRor: string | null): Map<string, string> {
  const counts = new Map<string, number>();
  for (const n of nodes) {
    if (n.isMe || !n.affiliation?.ror || n.affiliation.ror === myRor) continue;
    counts.set(n.affiliation.ror, (counts.get(n.affiliation.ror) || 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const map = new Map<string, string>();
  sorted.forEach(([ror], i) => map.set(ror, COMMUNITY_PALETTE[i % COMMUNITY_PALETTE.length]));
  return map;
}
