import type { EnrichedSimNode } from './relationship-types';

export type HullTier = 'institution' | 'journal' | 'none';

function pickMaxKey(counts: Map<string, number>, homeKey: string | null): string | null {
  let bestKey: string | null = null;
  let bestCount = -1;
  for (const [k, c] of counts) {
    if (c > bestCount) { bestKey = k; bestCount = c; continue; }
    if (c === bestCount && bestKey !== null) {
      if (k === homeKey) bestKey = k;
      else if (bestKey !== homeKey && k < bestKey) bestKey = k;
    }
  }
  return bestKey;
}

/** Pick the community key based on what's currently hull-able.
 *
 *  hullTier selects the top-level grouping:
 *    'institution' — institutions form the hulls; authors/journals/papers
 *      arrange inside them via affiliation.
 *    'journal' — institutions are hidden, journals take over: journals form
 *      the hulls; authors group by the journal they publish with most;
 *      papers by their own journal.
 *    'none' — no hulls. Everything floats.
 *
 *  One rule per tier, no per-toggle patching. */
export function explorerCommunityKey(
  n: EnrichedSimNode,
  institutionCountsByAuthor: Map<string, Map<string, number>>,
  journalCountsByAuthor: Map<string, Map<string, number>>,
  homeInstitutionId: string | null,
  journalByDoi: Map<string, string> | null,
  hullTier: HullTier,
): string | null {
  if (hullTier === 'none') return null;

  if (hullTier === 'institution') {
    if (n.group === 'institution') return n.id;
    if (n.group === 'author') {
      const counts = institutionCountsByAuthor.get(n.id);
      if (!counts || counts.size === 0) return null;
      return pickMaxKey(counts, homeInstitutionId);
    }
    // Journals and papers don't live inside institution hulls — a journal is
    // a venue, not an affiliation. They render as free nodes between hulls.
    return null;
  }

  // hullTier === 'journal'
  if (n.group === 'journal') return n.id;
  if (n.group === 'doi' && journalByDoi) return journalByDoi.get(n.id) ?? null;
  if (n.group === 'author') {
    const counts = journalCountsByAuthor.get(n.id);
    if (!counts || counts.size === 0) return null;
    return pickMaxKey(counts, null);
  }
  // Institutions aren't visible in this tier by definition.
  return null;
}
