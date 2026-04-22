import React, { useMemo } from 'react';
import type { EnrichedSimNode, ProjectedEdge } from './relationship-types';
import { COLORS, nodeRadius } from './relationship-types';
import type { ExplorerAffiliations } from './explorer-affiliations';
import { CommunityGraph, type CommunityAdapter } from './community-graph';
import { explorerCommunityKey, type HullTier } from './explorer-community';
import { computeVisibility } from './explorer-visibility';

function hullTierFor(nodes: EnrichedSimNode[]): HullTier {
  if (nodes.some(n => n.group === 'institution')) return 'institution';
  if (nodes.some(n => n.group === 'journal')) return 'journal';
  return 'none';
}

const PLACEHOLDER_RADIUS = 3;
const PLACEHOLDER_COLOR = 'rgba(255,255,255,0.22)';
const ZOOM_SCALE = 2.1;

interface Props {
  nodes: EnrichedSimNode[];
  links: ProjectedEdge[];
  width: number;
  height: number;
  selectedId?: string | null;
  onNodeClick?: (n: EnrichedSimNode) => void;
  affiliations: ExplorerAffiliations;
  homeInstitutionId?: string | null;
  egoAuthorId?: string | null;
  expandedIds: Set<string>;
  onExpand: (id: string) => void;
  externalHoverId?: string | null;
  onHoverChange?: (id: string | null) => void;
  onHullHoverChange?: (key: string | null) => void;
}

function baseRadius(n: EnrichedSimNode): number {
  return nodeRadius(n.weight || 1, n.role);
}

export function ForceGraph({ nodes, links, width, height, selectedId, onNodeClick, affiliations, homeInstitutionId = null, egoAuthorId = null, expandedIds, onExpand, externalHoverId, onHoverChange, onHullHoverChange }: Props) {
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

  const { placeholder } = useMemo(
    () => computeVisibility(nodes, links, affiliations, egoAuthorId, homeInstitutionId, expandedIds),
    [nodes, links, affiliations, egoAuthorId, homeInstitutionId, expandedIds],
  );

  const hullTier = useMemo(() => hullTierFor(nodes), [nodes]);

  const adapter = useMemo<CommunityAdapter<EnrichedSimNode>>(() => ({
    getId: n => n.id,
    getLabel: n => n.label,
    getRadius: n => (placeholder.has(n.id) ? PLACEHOLDER_RADIUS : baseRadius(n)),
    getCommunityKey: n => {
      if (hullTier === 'institution' && egoAuthorId && n.id === egoAuthorId) return homeInstitutionId;
      return explorerCommunityKey(n, affiliations.institutionCountsByAuthor, affiliations.journalCountsByAuthor, homeInstitutionId, journalByDoi, hullTier);
    },
    isEgo: n => !!egoAuthorId && n.id === egoAuthorId,
    getCommunityLabel: key => labelById.get(key) || key,
    getNodeColor: (n, communityColor) => {
      if (placeholder.has(n.id)) return PLACEHOLDER_COLOR;
      if (n.group === 'institution' || n.group === 'author' || n.group === 'journal') return communityColor;
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
  }), [affiliations, labelById, journalByDoi, egoAuthorId, homeInstitutionId, placeholder, hullTier]);

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
      minCommunitySize: 1,
      orbitRadius: 0.36,
    };
  }, [width, height, nodes.length, journalByDoi]);

  const handleClick = (n: EnrichedSimNode) => {
    if (n.id === selectedId) return;
    onExpand(n.id);
    onNodeClick?.(n);
  };

  return (
    <CommunityGraph<EnrichedSimNode, ProjectedEdge>
      nodes={nodes}
      links={links}
      adapter={adapter}
      primaryKey={homeInstitutionId}
      width={width}
      height={height}
      selectedId={selectedId ?? null}
      onNodeClick={handleClick}
      forceConfig={forceConfig}
      zoomToId={selectedId ?? null}
      zoomScale={ZOOM_SCALE}
      externalHoverId={externalHoverId ?? null}
      onHoverChange={onHoverChange}
      onHullHoverChange={onHullHoverChange}
    />
  );
}
