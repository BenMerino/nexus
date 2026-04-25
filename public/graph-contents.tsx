import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { EnrichedSimNode, ProjectedEdge } from './relationship-types';
import type { ExplorerAffiliations } from './explorer-affiliations';
import type { CommunityAdapter } from './community-graph';
import { buildBuckets } from './graph-contents-buckets';
import { useFlipReorder } from './use-flip-reorder';
import { prefetchNodeDetail } from './node-detail';
import { GraphSearch } from './graph-search';
import { HoverCard } from './hover-card';
import { BucketView } from './graph-contents-bucket';

/** Last-ditch fallback when labelById has no entry for a community key.
 *  Strips the `category:` prefix and any trailing ROR/URL noise so we
 *  show "030eybx10" instead of "institution:030eybx10". */
function prettyFallback(key: string): string {
  const bare = key.replace(/^[a-z]+:/, '');
  const m = bare.match(/\/([^/]+)\/?$/);
  return m ? m[1] : bare;
}

interface Props {
  nodes: EnrichedSimNode[];
  edges: ProjectedEdge[];
  /** All raw nodes — used to resolve labels for communities whose
   *  anchor node was filtered out of `nodes` by the visibility flags. */
  allNodes: { id: string; group: string; label: string }[];
  affiliations: ExplorerAffiliations;
  homeInstitutionId: string | null;
  egoAuthorId: string | null;
  coauthorIds: Set<string>;
  onSelect: (id: string) => void;
  onHover?: (id: string | null) => void;
  onHullHover?: (key: string | null) => void;
  hoveredId?: string | null;
  hoveredHullKey?: string | null;
  onSearchSelect?: (id: string) => void;
}

export function GraphContents({ nodes, edges, allNodes, affiliations, homeInstitutionId, egoAuthorId, coauthorIds, onSelect, onHover, onHullHover, hoveredId, hoveredHullKey, onSearchSelect }: Props) {
  const hoveredNode = useMemo(() => hoveredId ? nodes.find(n => n.id === hoveredId) ?? null : null, [hoveredId, nodes]);

  const labelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of allNodes) if (n.group === 'journal') m.set(n.id, n.label);
    return m;
  }, [allNodes]);

  const adapter = useMemo<CommunityAdapter<EnrichedSimNode>>(() => ({
    getId: n => n.id,
    getLabel: n => n.label,
    getRadius: () => 0,
    getCommunityKey: n => {
      if (n.group === 'doi') return (n as EnrichedSimNode & { journalId?: string }).journalId ?? null;
      if (n.group === 'author') {
        const counts = affiliations.journalCountsByAuthor.get(n.id);
        if (!counts || counts.size === 0) return null;
        let best: string | null = null; let bestN = -1;
        for (const [k, c] of counts) if (c > bestN) { best = k; bestN = c; }
        return best;
      }
      return null;
    },
    isEgo: n => !!egoAuthorId && n.id === egoAuthorId,
    getCommunityLabel: key => labelById.get(key) || prettyFallback(key),
  }), [affiliations, egoAuthorId, labelById]);

  const focusKey = useMemo(() => {
    if (hoveredId) {
      const hovered = nodes.find(n => n.id === hoveredId);
      if (hovered) return adapter.getCommunityKey(hovered);
    }
    return hoveredHullKey ?? null;
  }, [hoveredId, hoveredHullKey, nodes, adapter]);

  const buckets = useMemo(() => buildBuckets(nodes, adapter, homeInstitutionId, labelById, focusKey),
    [nodes, adapter, homeInstitutionId, labelById, focusKey]);

  const [openKey, setOpenKey] = useState<string | null>(null);

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
        {buckets.map(b => <BucketView key={b.key} b={b} open={openKey === b.key} onToggle={k => setOpenKey(prev => prev === k ? null : k)} onSelect={onSelect} onHover={onRowHover} onHullHover={onHullHover} />)}
      </div>
    </div>
  );
}

