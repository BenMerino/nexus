import { useMemo } from 'react';
import type { RawNode, RawEdge, EnrichedSimNode, EnrichedTagNode } from './relationship-types';
import type { CurrentUser } from './shell-helpers';
import { enrichWithMeta, type TagMetaMap } from './enrich-meta';
import { buildCoauthorSet } from './explorer-coauthors';

interface Args {
  projectedRaw: EnrichedTagNode[];
  tagMeta: TagMetaMap;
  rawNodes: RawNode[];
  rawEdges: RawEdge[];
  me: CurrentUser | null;
}

interface Result {
  projectedNodes: EnrichedSimNode[];
  coauthorIds: Set<string>;
  rawEgoAuthorId: string | null;
}

export function useExplorerNodes({ projectedRaw, tagMeta, rawNodes, rawEdges, me }: Args): Result {
  const rawEgoAuthorId = useMemo(() => {
    const orcid = me?.profile?.orcid;
    if (!orcid) return null;
    const hit = rawNodes.find(n => n.group === 'author' && n.ext_id === orcid);
    return hit?.id ?? null;
  }, [me, rawNodes]);

  const coauthorIds = useMemo(() => buildCoauthorSet(rawEdges, rawEgoAuthorId), [rawEdges, rawEgoAuthorId]);

  // The ego author isn't rendered as a node — the user's own papers stand
  // in for "you." The id stays around in `rawEgoAuthorId` so co-author
  // classification still works.
  const projectedNodes = useMemo(() => {
    const enriched = enrichWithMeta(projectedRaw, tagMeta);
    return enriched.filter(n =>
      (n.group === 'author' || n.group === 'doi') && n.id !== rawEgoAuthorId,
    ) as EnrichedSimNode[];
  }, [projectedRaw, tagMeta, rawEgoAuthorId]);

  return { projectedNodes, coauthorIds, rawEgoAuthorId };
}
