import type { EnrichedSimNode } from './relationship-types';
import { COLORS } from './relationship-types';
import type { ExplorerAffiliations } from './explorer-affiliations';
import { buildCommunityColors, majorCommunities, effectiveKey, OTHER_KEY } from './community-graph/communities';

/** Mirror the canvas logic to pick the accent color for a given node id:
 *  the community color its hull uses. Papers live in their journal's
 *  community; authors group by the journal they publish with most.
 *  Returns null if the node has no community or isn't in the projected set. */
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

  const adapter = {
    getId: (n: EnrichedSimNode) => n.id,
    getLabel: (n: EnrichedSimNode) => n.label,
    getRadius: () => 0,
    getCommunityKey: (n: EnrichedSimNode) => communityKeyFor(n, affiliations),
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

function communityKeyFor(n: EnrichedSimNode, affiliations: ExplorerAffiliations): string | null {
  if (n.group === 'doi') return (n as EnrichedSimNode & { journalId?: string }).journalId ?? null;
  if (n.group === 'author') {
    const counts = affiliations.journalCountsByAuthor.get(n.id);
    if (!counts || counts.size === 0) return null;
    let best: string | null = null; let bestN = -1;
    for (const [k, c] of counts) if (c > bestN) { best = k; bestN = c; }
    return best;
  }
  return null;
}
