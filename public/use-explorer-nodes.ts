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

  // Structural set: papers + every author that touches any paper. Stable —
  // doesn't depend on the visibility flags, so toggling "hide authors" or
  // hovering a paper doesn't re-seed the force sim. The renderer consumes
  // separate `hiddenIds` state to dim nodes in/out.
  const projectedNodes = useMemo(() => {
    const enriched = enrichWithMeta(projectedRaw, tagMeta);
    // Institutions + journals aren't rendered as nodes.
    return enriched.filter(n => n.group === 'author' || n.group === 'doi') as EnrichedSimNode[];
  }, [projectedRaw, tagMeta]);

  return { projectedNodes, coauthorIds, rawEgoAuthorId };
}
