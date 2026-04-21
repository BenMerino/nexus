import React, { useMemo } from 'react';
import type { EnrichedSimNode, ProjectedEdge } from './relationship-types';
import { COLORS, nodeRadius } from './relationship-types';
import type { ExplorerAffiliations } from './explorer-affiliations';
import { CommunityGraph, type CommunityAdapter } from './community-graph';

interface Props {
  nodes: EnrichedSimNode[];
  links: ProjectedEdge[];
  width: number;
  height: number;
  selectedId?: string | null;
  onNodeClick?: (n: EnrichedSimNode) => void;
  affiliations: ExplorerAffiliations;
  /** Home institution node id — receives accent color + hull emphasis. */
  homeInstitutionId?: string | null;
  /** Logged-in user's author node id — pinned at center as ego. */
  egoAuthorId?: string | null;
}

function radius(n: EnrichedSimNode): number {
  return nodeRadius(n.weight || 1, n.role);
}

/** Pick the community key for an Explorer node. Authors inherit their first
 *  institution; institution nodes are their own community. When papers are
 *  visible, journals become their own community and papers inherit theirs —
 *  so journal hulls gather their papers. Otherwise journals/papers return
 *  null (land in "Other"). */
function communityKeyFor(
  n: EnrichedSimNode,
  institutionsByAuthor: Map<string, Set<string>>,
  journalByDoi: Map<string, string> | null,
): string | null {
  if (n.group === 'institution') return n.id;
  if (n.group === 'author') {
    const insts = institutionsByAuthor.get(n.id);
    if (!insts || insts.size === 0) return null;
    return [...insts].sort()[0];
  }
  if (journalByDoi) {
    if (n.group === 'journal') return n.id;
    if (n.group === 'doi') return journalByDoi.get(n.id) ?? null;
  }
  return null;
}

export function ForceGraph({ nodes, links, width, height, selectedId, onNodeClick, affiliations, homeInstitutionId = null, egoAuthorId = null }: Props) {
  const labelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of nodes) if (n.group === 'institution' || n.group === 'journal') m.set(n.id, n.label);
    return m;
  }, [nodes]);

  // Papers get grouped by journal only when papers are actually on screen.
  const journalByDoi = useMemo(() => {
    const hasPapers = nodes.some(n => n.group === 'doi');
    if (!hasPapers) return null;
    const m = new Map<string, string>();
    for (const [journalId, dois] of affiliations.doisByJournal) {
      for (const doi of dois) m.set(doi, journalId);
    }
    return m;
  }, [nodes, affiliations.doisByJournal]);

  const adapter = useMemo<CommunityAdapter<EnrichedSimNode>>(() => ({
    getId: n => n.id,
    getLabel: n => n.label,
    getRadius: radius,
    getCommunityKey: n => {
      if (egoAuthorId && n.id === egoAuthorId) return homeInstitutionId;
      return communityKeyFor(n, affiliations.institutionsByAuthor, journalByDoi);
    },
    isEgo: n => !!egoAuthorId && n.id === egoAuthorId,
    getCommunityLabel: key => labelById.get(key) || key,
    getNodeColor: (n, communityColor) => {
      if (n.group === 'institution' || n.group === 'author') return communityColor;
      // Journals match their hull when papers are shown; otherwise stay static type color.
      if (n.group === 'journal' && journalByDoi) return communityColor;
      return COLORS[n.group] || null;
    },
    getHoverSubtitle: n => {
      if (n.group !== 'author') return null;
      const insts = affiliations.institutionsByAuthor.get(n.id);
      if (!insts || insts.size === 0) return null;
      const firstId = [...insts].sort()[0];
      return labelById.get(firstId) || null;
    },
    getHoverFootnote: n => (n.weight ? `${n.weight} ${n.weight === 1 ? 'paper' : 'papers'}` : null),
  }), [affiliations, labelById, journalByDoi, egoAuthorId, homeInstitutionId]);

  const forceConfig = useMemo(() => {
    const area = Math.max(width * height, 1);
    const perNode = Math.sqrt(area / Math.max(nodes.length, 1));
    const linkDistance = Math.max(24, Math.min(140, perNode * 0.8));
    const clusterStrength = Math.max(0.12, Math.min(0.45, 0.12 + 2 / Math.sqrt(Math.max(nodes.length, 1))));
    const charge = -Math.min(400, perNode * 6);
    return {
      linkDistance,
      linkStrength: 0.1,
      charge: (g: string | undefined) => (g === 'doi' ? charge * 0.3 : charge),
      clusterStrengthX: clusterStrength,
      clusterStrengthY: clusterStrength,
      collidePad: 6,
      minCommunitySize: 2,
      orbitRadius: 0.45,
    };
  }, [width, height, nodes.length]);

  return (
    <CommunityGraph<EnrichedSimNode, ProjectedEdge>
      nodes={nodes}
      links={links}
      adapter={adapter}
      primaryKey={homeInstitutionId}
      width={width}
      height={height}
      selectedId={selectedId ?? null}
      onNodeClick={onNodeClick}
      forceConfig={forceConfig}
    />
  );
}
