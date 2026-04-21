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
 *  institution; institution nodes are their own community; journals, papers,
 *  and orphaned authors return null (land in "Other"). */
function communityKeyFor(n: EnrichedSimNode, institutionsByAuthor: Map<string, Set<string>>): string | null {
  if (n.group === 'institution') return n.id;
  if (n.group === 'author') {
    const insts = institutionsByAuthor.get(n.id);
    if (!insts || insts.size === 0) return null;
    return [...insts].sort()[0];
  }
  return null;
}

export function ForceGraph({ nodes, links, width, height, selectedId, onNodeClick, affiliations, homeInstitutionId = null, egoAuthorId = null }: Props) {
  const institutionLabelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of nodes) if (n.group === 'institution') m.set(n.id, n.label);
    return m;
  }, [nodes]);

  const adapter = useMemo<CommunityAdapter<EnrichedSimNode>>(() => ({
    getId: n => n.id,
    getLabel: n => n.label,
    getRadius: radius,
    getCommunityKey: n => {
      if (egoAuthorId && n.id === egoAuthorId) return homeInstitutionId;
      return communityKeyFor(n, affiliations.institutionsByAuthor);
    },
    isEgo: n => !!egoAuthorId && n.id === egoAuthorId,
    getCommunityLabel: key => institutionLabelById.get(key) || key,
    getNodeColor: (n, communityColor) => {
      // Institutions and authors use community colors so hulls + nodes match.
      if (n.group === 'institution' || n.group === 'author') return communityColor;
      // Journals and papers keep their static type color for clarity.
      return COLORS[n.group] || null;
    },
    getHoverSubtitle: n => {
      if (n.group !== 'author') return null;
      const insts = affiliations.institutionsByAuthor.get(n.id);
      if (!insts || insts.size === 0) return null;
      const firstId = [...insts].sort()[0];
      return institutionLabelById.get(firstId) || null;
    },
    getHoverFootnote: n => (n.weight ? `${n.weight} ${n.weight === 1 ? 'paper' : 'papers'}` : null),
  }), [affiliations, institutionLabelById, egoAuthorId, homeInstitutionId]);

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
