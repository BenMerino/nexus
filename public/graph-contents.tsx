import React, { useCallback, useMemo, useRef } from 'react';
import type { EnrichedSimNode, ProjectedEdge } from './relationship-types';
import type { ExplorerAffiliations } from './explorer-affiliations';
import { explorerCommunityKey, type HullTier } from './explorer-community';
import type { CommunityAdapter } from './community-graph';
import { buildBuckets } from './graph-contents-buckets';
import { useFlipReorder } from './use-flip-reorder';
import { prefetchNodeDetail } from './node-detail';
import { GraphSearch } from './graph-search';
import { HoverCard } from './hover-card';
import { BucketView } from './graph-contents-bucket';

interface Props {
  nodes: EnrichedSimNode[];
  edges: ProjectedEdge[];
  affiliations: ExplorerAffiliations;
  homeInstitutionId: string | null;
  egoAuthorId: string | null;
  coauthorIds: Set<string>;
  onSelect: (id: string) => void;
  onHover?: (id: string | null) => void;
  hoveredId?: string | null;
  hoveredHullKey?: string | null;
  onSearchSelect?: (id: string) => void;
}

export function GraphContents({ nodes, edges, affiliations, homeInstitutionId, egoAuthorId, coauthorIds, onSelect, onHover, hoveredId, hoveredHullKey, onSearchSelect }: Props) {
  const hoveredNode = useMemo(() => hoveredId ? nodes.find(n => n.id === hoveredId) ?? null : null, [hoveredId, nodes]);
  const journalByDoi = useMemo(() => {
    const hasPapers = nodes.some(n => n.group === 'doi');
    if (!hasPapers) return null;
    const m = new Map<string, string>();
    for (const [jId, dois] of affiliations.doisByJournal) for (const d of dois) m.set(d, jId);
    return m;
  }, [nodes, affiliations.doisByJournal]);

  const labelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of nodes) if (n.group === 'institution' || n.group === 'journal') m.set(n.id, n.label);
    return m;
  }, [nodes]);

  const hullTier: HullTier = useMemo(() => {
    if (nodes.some(n => n.group === 'institution')) return 'institution';
    if (nodes.some(n => n.group === 'journal')) return 'journal';
    return 'none';
  }, [nodes]);

  const adapter = useMemo<CommunityAdapter<EnrichedSimNode>>(() => ({
    getId: n => n.id,
    getLabel: n => n.label,
    getRadius: () => 0,
    getCommunityKey: n => {
      if (hullTier === 'institution' && egoAuthorId && n.id === egoAuthorId) return homeInstitutionId;
      return explorerCommunityKey(n, affiliations.institutionCountsByAuthor, affiliations.journalCountsByAuthor, homeInstitutionId, journalByDoi, hullTier);
    },
    isEgo: n => !!egoAuthorId && n.id === egoAuthorId,
    getCommunityLabel: key => labelById.get(key) || key,
  }), [affiliations, homeInstitutionId, egoAuthorId, journalByDoi, labelById, hullTier]);

  const focusKey = useMemo(() => {
    if (hoveredId) {
      const hovered = nodes.find(n => n.id === hoveredId);
      if (hovered) return adapter.getCommunityKey(hovered);
    }
    return hoveredHullKey ?? null;
  }, [hoveredId, hoveredHullKey, nodes, adapter]);

  const buckets = useMemo(() => buildBuckets(nodes, adapter, homeInstitutionId, labelById, focusKey),
    [nodes, adapter, homeInstitutionId, labelById, focusKey]);

  const listRef = useRef<HTMLDivElement>(null);
  useFlipReorder(listRef, buckets.map(b => b.key));

  // Debounced prefetch on hover. Fires ~120ms after the cursor settles on a
  // row so sweeping across the list doesn't burn a request per node. By the
  // time the user actually clicks, the detail is usually cached and the
  // filmstrip slide reveals a fully-populated pane instead of a blank one.
  const prefetchTimer = useRef<number | null>(null);
  const onRowHover = useCallback((id: string | null) => {
    onHover?.(id);
    if (prefetchTimer.current) { clearTimeout(prefetchTimer.current); prefetchTimer.current = null; }
    if (id) prefetchTimer.current = window.setTimeout(() => prefetchNodeDetail(id), 120);
  }, [onHover]);

  if (!nodes.length) return null;

  return (
    <div className="graph-contents">
      <div className="graph-contents-head">
        <div className="eyebrow">Graph contents</div>
        <div className="graph-contents-search">
          <GraphSearch nodes={nodes} onSelect={id => (onSearchSelect || onSelect)(id)} />
        </div>
      </div>
      {hoveredNode && (
        <HoverCard
          node={hoveredNode} nodes={nodes} edges={edges}
          egoAuthorId={egoAuthorId} homeInstitutionId={homeInstitutionId}
          coauthorIds={coauthorIds}
        />
      )}
      <div ref={listRef} className="graph-contents-list">
        {buckets.map(b => <BucketView key={b.key} b={b} onSelect={onSelect} onHover={onRowHover} />)}
      </div>
    </div>
  );
}

