import type { EnrichedSimNode } from './relationship-types';
import { COLORS } from './relationship-types';
import type { ExplorerAffiliations } from './explorer-affiliations';
import { explorerCommunityKey, type HullTier } from './explorer-community';
import { buildCommunityColors, majorCommunities, effectiveKey, OTHER_KEY } from './community-graph/communities';

/** Mirror the canvas logic to pick the accent color for a given node id:
 *  the community color its hull uses. Returns null if the node has no
 *  community or isn't currently in the projected set. */
export function explorerSelectedColor(
  selectedId: string | null,
  nodes: EnrichedSimNode[],
  affiliations: ExplorerAffiliations,
  homeInstitutionId: string | null,
  egoAuthorId: string | null,
): string | null {
  if (!selectedId) return null;
  const node = nodes.find(n => n.id === selectedId);
  if (!node) return null;

  const hasPapers = nodes.some(n => n.group === 'doi');
  const journalByDoi = hasPapers
    ? (() => {
        const m = new Map<string, string>();
        for (const [jId, dois] of affiliations.doisByJournal) for (const d of dois) m.set(d, jId);
        return m;
      })()
    : null;

  const hullTier: HullTier = nodes.some(n => n.group === 'institution')
    ? 'institution' : nodes.some(n => n.group === 'journal') ? 'journal' : 'none';

  const adapter = {
    getId: (n: EnrichedSimNode) => n.id,
    getLabel: (n: EnrichedSimNode) => n.label,
    getRadius: () => 0,
    getCommunityKey: (n: EnrichedSimNode) => {
      if (hullTier === 'institution' && egoAuthorId && n.id === egoAuthorId) return homeInstitutionId;
      return explorerCommunityKey(n, affiliations.institutionCountsByAuthor, affiliations.journalCountsByAuthor, homeInstitutionId, journalByDoi, hullTier);
    },
    isEgo: (n: EnrichedSimNode) => !!egoAuthorId && n.id === egoAuthorId,
  };

  const minSize = 1;
  const colors = buildCommunityColors(nodes, adapter, homeInstitutionId, minSize);
  const major = majorCommunities(nodes, adapter, homeInstitutionId, minSize);
  const key = effectiveKey(node, adapter, major);
  if (!key) return COLORS[node.group] || null;
  if (key === OTHER_KEY) return colors.get(OTHER_KEY) || null;
  return colors.get(key) || null;
}
