import type { EnrichedSimNode } from './relationship-types';

/** Pick the community key for an Explorer node. Authors go to the
 *  institution with the highest paper count in their authoritative
 *  affiliations (from doi_records.authors JSON, not co-occurrence).
 *  Institutions are their own community. When papers are visible,
 *  journals become their own community and papers inherit theirs.
 *  Home breaks ties so equal-split authors prefer the tenant. */
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
    let bestKey: string | null = null;
    let bestCount = -1;
    for (const [k, c] of counts) {
      if (c > bestCount) { bestKey = k; bestCount = c; continue; }
      if (c === bestCount && bestKey !== null) {
        // tie-break: home institution wins; otherwise lexicographic for stability
        if (k === homeInstitutionId) bestKey = k;
        else if (bestKey !== homeInstitutionId && k < bestKey) bestKey = k;
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
