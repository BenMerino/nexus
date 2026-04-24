import { useMemo } from 'react';
import type { RawNode, RawEdge, EnrichedSimNode, EnrichedTagNode, ProjectedEdge } from './relationship-types';
import type { NodeTypeFlags } from './graph-filters-sidebar';
import type { CurrentUser } from './shell-helpers';
import { enrichWithMeta, type TagMetaMap } from './enrich-meta';
import { buildCoauthorSet } from './explorer-coauthors';

interface Args {
  projectedRaw: EnrichedTagNode[];
  projectedEdges: ProjectedEdge[];
  tagMeta: TagMetaMap;
  rawNodes: RawNode[];
  rawEdges: RawEdge[];
  me: CurrentUser | null;
  flags: NodeTypeFlags;
  /** When set, papers adjacent to this node are kept visible even if
   *  flags.paper is off — revealing the focused node's path structure. */
  focusedId?: string | null;
}

interface Result {
  projectedNodes: EnrichedSimNode[];
  coauthorIds: Set<string>;
  rawEgoAuthorId: string | null;
}

export function useExplorerNodes({ projectedRaw, projectedEdges, tagMeta, rawNodes, rawEdges, me, flags, focusedId }: Args): Result {
  const rawEgoAuthorId = useMemo(() => {
    const orcid = me?.profile.orcid;
    if (!orcid) return null;
    const hit = rawNodes.find(n => n.group === 'author' && n.ext_id === orcid);
    return hit?.id ?? null;
  }, [me, rawNodes]);

  const coauthorIds = useMemo(() => buildCoauthorSet(rawEdges, rawEgoAuthorId), [rawEdges, rawEgoAuthorId]);

  // Papers adjacent to the focused node stay visible even when flags.paper
  // is off — selecting a node reveals the paper bridges that connect it to
  // its neighbors without forcing the user to toggle all papers on.
  const bridgePaperIds = useMemo(() => {
    if (!focusedId || flags.paper) return null;
    const set = new Set<string>();
    for (const e of projectedEdges) {
      if (e.source === focusedId && e.target.startsWith('doi:')) set.add(e.target);
      if (e.target === focusedId && e.source.startsWith('doi:')) set.add(e.source);
    }
    return set;
  }, [focusedId, flags.paper, projectedEdges]);

  const homeInstitutionId = useMemo(() => {
    const ror = me?.profile.ror?.replace(/^https?:\/\/ror\.org\//, '') ?? null;
    if (!ror) return null;
    const hit = rawNodes.find(n => n.group === 'institution' && n.ext_id?.replace(/^https?:\/\/ror\.org\//, '') === ror);
    return hit?.id ?? null;
  }, [me, rawNodes]);

  const projectedNodes = useMemo(() => {
    const enriched = enrichWithMeta(projectedRaw, tagMeta);
    // Ego and home institution are "fixed" in the sidebar — they always stay
    // visible regardless of class-level toggles, so the graph always has an
    // ego to anchor relationships to.
    const authorAllowed = (id: string) => {
      if (id === rawEgoAuthorId) return true;
      return coauthorIds.has(id) ? flags.coauthor : flags.author;
    };
    const institutionAllowed = (id: string) => id === homeInstitutionId || flags.institution;
    const paperAllowed = (id: string) => flags.paper || (bridgePaperIds?.has(id) ?? false);
    const groupMatch = (n: { id: string; group: string }) =>
      (n.group === 'institution' && institutionAllowed(n.id)) ||
      (n.group === 'author' && authorAllowed(n.id)) ||
      (n.group === 'journal' && flags.journal) ||
      (n.group === 'doi' && paperAllowed(n.id));
    return enriched.filter(n => groupMatch(n)) as EnrichedSimNode[];
  }, [projectedRaw, tagMeta, flags, coauthorIds, rawEgoAuthorId, homeInstitutionId, bridgePaperIds]);

  return { projectedNodes, coauthorIds, rawEgoAuthorId };
}
