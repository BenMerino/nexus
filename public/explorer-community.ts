import type { EnrichedSimNode } from './relationship-types';

/** Pick the community key for an Explorer node. Authors go to their home
 *  institution (if affiliated) or the institution they publish with most.
 *  Institutions are their own community. When papers are visible, journals
 *  become their own community and papers inherit theirs. */
export function explorerCommunityKey(
  n: EnrichedSimNode,
  institutionCountsByAuthor: Map<string, Map<string, number>>,
  homeInstitutionId: string | null,
  journalByDoi: Map<string, string> | null,
): string | null {
  if (n.group === 'institution') return n.id;
  if (n.group === 'author') {
    const counts = institutionCountsByAuthor.get(n.id);
    if (!counts || counts.size === 0) return null;
    if (homeInstitutionId && counts.has(homeInstitutionId)) return homeInstitutionId;
    let bestKey: string | null = null;
    let bestCount = -1;
    for (const [k, c] of counts) {
      if (c > bestCount || (c === bestCount && bestKey !== null && k < bestKey)) {
        bestKey = k;
        bestCount = c;
      }
    }
    return bestKey;
  }
  if (journalByDoi) {
    if (n.group === 'journal') return n.id;
    if (n.group === 'doi') return journalByDoi.get(n.id) ?? null;
  }
  return null;
}
