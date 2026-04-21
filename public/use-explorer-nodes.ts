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

  const projectedNodes = useMemo(() => {
    const enriched = enrichWithMeta(projectedRaw, tagMeta);
    const authorAllowed = (id: string) => {
      if (id === rawEgoAuthorId) return flags.author || flags.coauthor;
      return coauthorIds.has(id) ? flags.coauthor : flags.author;
    };
    const groupMatch = (n: { id: string; group: string }) =>
      (n.group === 'institution' && flags.institution) ||
      (n.group === 'author' && authorAllowed(n.id)) ||
      (n.group === 'journal' && flags.journal) ||
      (n.group === 'doi' && flags.paper);
    return enriched.filter(n => groupMatch(n)) as EnrichedSimNode[];
  }, [projectedRaw, tagMeta, flags, coauthorIds, rawEgoAuthorId]);

  return { projectedNodes, coauthorIds, rawEgoAuthorId };
}
