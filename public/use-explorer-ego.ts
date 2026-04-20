import { useMemo } from 'react';
import type { RawNode, EnrichedSimNode } from './relationship-types';
import type { CurrentUser } from './shell-helpers';

interface Args {
  me: CurrentUser | null;
  rawNodes: RawNode[];
  projectedNodes: EnrichedSimNode[];
  institutionsByAuthor: Map<string, Set<string>>;
}

interface Result {
  /** Logged-in user's author node id — pinned at center as the graph ego. */
  egoAuthorId: string | null;
  /** Community key for the hull-at-center. Prefer the tenant's ROR; fall
   *  back to the ego author's most-shared institution so the center is never
   *  empty when the logged-in user is on the graph. */
  effectiveHomeKey: string | null;
}

export function useExplorerEgo({ me, rawNodes, projectedNodes, institutionsByAuthor }: Args): Result {
  const homeInstitutionId = useMemo(() => {
    const ror = me?.profile.ror;
    if (!ror) return null;
    const hit = rawNodes.find(n => n.group === 'institution' && n.ext_id === ror);
    return hit?.id ?? null;
  }, [me, rawNodes]);

  const egoAuthorId = useMemo(() => {
    const orcid = me?.profile.orcid;
    if (!orcid) return null;
    const hit = projectedNodes.find(n => n.group === 'author' && n.ext_id === orcid);
    return hit?.id ?? null;
  }, [me, projectedNodes]);

  const effectiveHomeKey = useMemo(() => {
    if (homeInstitutionId) return homeInstitutionId;
    if (!egoAuthorId) return null;
    const insts = institutionsByAuthor.get(egoAuthorId);
    if (!insts || insts.size === 0) return null;
    return [...insts].sort()[0];
  }, [homeInstitutionId, egoAuthorId, institutionsByAuthor]);

  return { egoAuthorId, effectiveHomeKey };
}
