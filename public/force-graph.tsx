import React, { useMemo } from 'react';
import type { EnrichedSimNode, ProjectedEdge } from './relationship-types';
import { COLORS, nodeRadius } from './relationship-types';
import type { ExplorerAffiliations } from './explorer-affiliations';
import { CommunityGraph, type CommunityAdapter } from './community-graph';
import { computeVisibility } from './explorer-visibility';
import { DEFAULT_LAYER_ORDER, type LayerType } from './explorer-layers';
import { explorerLayerZ } from './explorer-layer-z';

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
  tilt?: number;
  layerOrder?: LayerType[];
  coauthorIds?: Set<string>;
  /** journalId → human name. Journals aren't nodes anymore but hulls still
   *  label communities with the journal name, so we need a separate lookup. */
  journalLabels?: Map<string, string>;
}

function baseRadius(n: EnrichedSimNode): number {
  return nodeRadius(n.weight || 1, n.role);
}

const EMPTY_IDS: Set<string> = new Set();

export function ForceGraph({ nodes, links, width, height, selectedId, onNodeClick, affiliations, homeInstitutionId = null, egoAuthorId = null, expandedIds, onExpand, externalHoverId, onHoverChange, onHullHoverChange, tilt = 0, layerOrder = DEFAULT_LAYER_ORDER, coauthorIds = EMPTY_IDS, journalLabels }: Props) {
  const { placeholder } = useMemo(
    () => computeVisibility(nodes, links, affiliations, egoAuthorId, homeInstitutionId, expandedIds),
    [nodes, links, affiliations, egoAuthorId, homeInstitutionId, expandedIds],
  );

  const adapter = useMemo<CommunityAdapter<EnrichedSimNode>>(() => ({
    getId: n => n.id,
    getLabel: n => n.label,
    getRadius: n => (placeholder.has(n.id) ? PLACEHOLDER_RADIUS : baseRadius(n)),
    getCommunityKey: n => {
      // Papers live in their journal's community. Authors (including the ego)
      // group into the journal they publish with most. No journal → no
      // community; the node floats.
      if (n.group === 'doi') {
        const nj = (n as unknown as { journalId?: string }).journalId;
        return nj ?? null;
      }
      if (n.group === 'author') {
        const counts = affiliations.journalCountsByAuthor.get(n.id);
        if (!counts || counts.size === 0) return null;
        let bestKey: string | null = null; let best = -1;
        for (const [k, c] of counts) if (c > best) { bestKey = k; best = c; }
        return bestKey;
      }
      return null;
    },
    isEgo: n => !!egoAuthorId && n.id === egoAuthorId,
    getCommunityLabel: key => (journalLabels && journalLabels.get(key)) || key,
    getNodeColor: (n, communityColor) => {
      if (placeholder.has(n.id)) return PLACEHOLDER_COLOR;
      if (n.group === 'author') return communityColor;
      return COLORS[n.group] || null;
    },
    getHoverSubtitle: () => null,
    getHoverFootnote: n => (n.weight ? `${n.weight} ${n.weight === 1 ? 'paper' : 'papers'}` : null),
    getLayerZ: n => explorerLayerZ({ n, layerOrder, coauthorIds, homeInstitutionId, egoAuthorId }),
    getTypeTag: n => {
      if (n.id === egoAuthorId) return 'EGO';
      if (n.group === 'doi') return 'PAPER';
      if (n.group === 'author') return coauthorIds.has(n.id) ? 'CO-AUTHOR' : 'AUTHOR';
      return null;
    },
  }), [affiliations, journalLabels, egoAuthorId, homeInstitutionId, placeholder, layerOrder, coauthorIds]);

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
  }, [width, height, nodes.length]);

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
      tilt={tilt}
    />
  );
}
