import { useMemo } from 'react';
import type { RawNode, RawEdge, EnrichedSimNode, EnrichedTagNode } from './relationship-types';
import type { NodeTypeFlags } from './graph-filters-sidebar';
import type { CurrentUser } from './shell-helpers';
import { enrichWithMeta, type TagMetaMap } from './enrich-meta';
import { buildCoauthorSet } from './explorer-coauthors';

interface Args {
  projectedRaw: EnrichedTagNode[];
  tagMeta: TagMetaMap;
  rawNodes: RawNode[];
  rawEdges: RawEdge[];
  me: CurrentUser | null;
  flags: NodeTypeFlags;
}

interface Result {
  projectedNodes: EnrichedSimNode[];
  coauthorIds: Set<string>;
  rawEgoAuthorId: string | null;
}

export function useExplorerNodes({ projectedRaw, tagMeta, rawNodes, rawEdges, me, flags }: Args): Result {
  const rawEgoAuthorId = useMemo(() => {
    const orcid = me?.profile.orcid;
    if (!orcid) return null;
    const hit = rawNodes.find(n => n.group === 'author' && n.ext_id === orcid);
    return hit?.id ?? null;
  }, [me, rawNodes]);

  const coauthorIds = useMemo(() => buildCoauthorSet(rawEdges, rawEgoAuthorId), [rawEdges, rawEgoAuthorId]);

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
    // Institutions (home or otherwise) aren't rendered as nodes — you and
    // your co-authors embody your institution's network in concept.
    const institutionAllowed = () => false;
    const groupMatch = (n: { id: string; group: string }) =>
      (n.group === 'institution' && institutionAllowed()) ||
      (n.group === 'author' && authorAllowed(n.id)) ||
      (n.group === 'journal' && flags.journal) ||
      (n.group === 'doi' && flags.paper);
    return enriched.filter(n => groupMatch(n)) as EnrichedSimNode[];
  }, [projectedRaw, tagMeta, flags, coauthorIds, rawEgoAuthorId, homeInstitutionId]);

  return { projectedNodes, coauthorIds, rawEgoAuthorId };
}
