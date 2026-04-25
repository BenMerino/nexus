import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { projectGraph } from './project-graph';
import { NodeDetail, prefetchNodeDetail } from './node-detail';
import { ExplorerCanvas } from './explorer-canvas';
import { GraphSearch } from './graph-search';
import { useGraphData } from './use-graph-data';
import { useCurrentUser } from './shell-helpers';
import { GraphFiltersSidebar, type NodeTypeFlags } from './graph-filters-sidebar';
import { buildExplorerAffiliations } from './explorer-affiliations';
import { useExplorerEgo } from './use-explorer-ego';
import { useExplorerNodes } from './use-explorer-nodes';
import { GraphContents } from './graph-contents';
import { explorerSelectedColor } from './explorer-selected-color';
import { useSelectionStack } from './use-selection-stack';
import { useYearRangeFilter } from './use-year-range-filter';
import { useLayerOrder } from './use-layer-order';
import { GraphCanvasCorners } from './graph-canvas-corners';
import { useHiddenAuthors } from './use-hidden-authors';

const DEFAULT_FLAGS: NodeTypeFlags = { institution: false, author: false, coauthor: false, journal: false, paper: true };

export function GraphExplorerBody() {
  const { rawNodes, rawEdges, affiliations: authoritativeAffs, tagMeta, loading } = useGraphData();
  const { selectionStack, selectedNodeId, navDir, pushSelection, popSelection } = useSelectionStack();
  const detailPanelRef = useRef<HTMLElement>(null);
  const [hover, setHover] = useState<{ id: string | null; source: 'canvas' | 'sidebar' }>({ id: null, source: 'canvas' });
  const hoverId = hover.id;
  const prefetchTimer = useRef<number | null>(null);
  const schedulePrefetch = useCallback((id: string | null) => {
    if (prefetchTimer.current) { clearTimeout(prefetchTimer.current); prefetchTimer.current = null; }
    if (id) prefetchTimer.current = window.setTimeout(() => prefetchNodeDetail(id), 120);
  }, []);
  const hoverFromCanvas = useCallback((id: string | null) => {
    setHover({ id, source: 'canvas' });
    schedulePrefetch(id);
  }, [schedulePrefetch]);
  const hoverFromSidebar = useCallback((id: string | null) => setHover({ id, source: 'sidebar' }), []);
  const [hullHoverKey, setHullHoverKey] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const expand = useCallback((id: string) => setExpandedIds(prev => {
    if (prev.has(id)) return prev;
    const n = new Set(prev); n.add(id); return n;
  }), []);
  const [flags, setFlags] = useState<NodeTypeFlags>(DEFAULT_FLAGS);
  const setFlag = useCallback((k: keyof NodeTypeFlags, v: boolean) => setFlags(f => ({ ...f, [k]: v })), []);
  const [tilted, setTilted] = useState<boolean>(() => {
    try { return localStorage.getItem('graph-tilted') === '1'; } catch { return false; }
  });
  const toggleTilt = useCallback(() => {
    setTilted(v => {
      const next = !v;
      try { localStorage.setItem('graph-tilted', next ? '1' : '0'); } catch {}
      return next;
    });
  }, []);
  const { layerOrder, reorderLayer } = useLayerOrder();
  const { yearMin, yearMax, yearFrom, yearTo, setRange, filteredRaw } = useYearRangeFilter(rawNodes, rawEdges);
  const highlightedIds = useMemo(() => {
    const o = new URLSearchParams(window.location.search).get('highlight');
    return o ? new Set([`author:${o}`]) : new Set<string>();
  }, []);
  const { me } = useCurrentUser();

  useEffect(() => {
    if (!rawNodes.length) return;
    const f = highlightedIds.values().next().value;
    if (f && rawNodes.some(n => n.id === f)) pushSelection(f);
  }, [rawNodes, highlightedIds]);

  // Reset the scroll position of each pane on selection change so the user
  // lands at the top of whatever pane slides into view.
  useEffect(() => {
    const el = detailPanelRef.current;
    if (!el) return;
    el.querySelectorAll<HTMLElement>('.node-detail-pane').forEach(p => { p.scrollTop = 0; });
  }, [selectedNodeId]);

  // Always include paper edges in the projection; useExplorerNodes decides
  // which paper nodes to keep based on flags.paper + any focused node's
  // bridge papers.
  const { nodes: projectedRaw, edges: projectedEdgesAll } = useMemo(
    () => projectGraph(filteredRaw.nodes, filteredRaw.edges, new Set(['institution', 'author', 'journal']), [], null, true),
    [filteredRaw]);

  const { projectedNodes, coauthorIds } = useExplorerNodes({ projectedRaw, tagMeta, rawNodes, rawEdges, me, flags });

  const projectedEdges = useMemo(() => {
    const ids = new Set(projectedNodes.map(n => n.id));
    return projectedEdgesAll.filter(e => ids.has(e.source) && ids.has(e.target));
  }, [projectedEdgesAll, projectedNodes]);

  const affiliations = useMemo(() => buildExplorerAffiliations(rawNodes, rawEdges, authoritativeAffs), [rawNodes, rawEdges, authoritativeAffs]);

  // Journals aren't nodes anymore, but hull labels still need their names.
  const journalLabels = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of rawNodes) if (n.group === 'journal') m.set(n.id, n.label);
    return m;
  }, [rawNodes]);

  const { egoAuthorId, effectiveHomeKey } = useExplorerEgo({ me, rawNodes, projectedNodes, institutionsByAuthor: affiliations.institutionsByAuthor });
  const hiddenIds = useHiddenAuthors(projectedNodes, projectedEdges, hoverId, coauthorIds, flags, egoAuthorId);
  // Hovering a paper while authors are globally hidden → render only that
  // paper's edges, so revealing its authors doesn't surface their other edges.
  const edgesOnlyForId = !flags.author && !flags.coauthor && hoverId?.startsWith('doi:') ? hoverId : null;

  if (loading) return <div className="view"><div className="eyebrow">Loading graph data…</div></div>;
  if (!rawNodes.length) return <div className="view"><div className="eyebrow">No data.</div></div>;

  return (
    <div className="graph-view fullbleed">
      <div className="graph-canvas fullbleed">
        <GraphCanvasCorners tenant={me?.tenant ?? null} role={me?.role ?? null} yearFrom={yearFrom} yearTo={yearTo} yearMin={yearMin} yearMax={yearMax} tilted={tilted} onToggleTilt={toggleTilt} />

        {projectedNodes.length === 0
          ? <div style={{ padding: 40, textAlign: 'center', position: 'relative', zIndex: 1 }} className="muted">No nodes match the current filters.</div>
          : <ExplorerCanvas nodes={projectedNodes} links={projectedEdges} affiliations={affiliations} homeInstitutionId={effectiveHomeKey} egoAuthorId={egoAuthorId} selectedId={selectedNodeId} onNodeClick={n => pushSelection(n.id)} expandedIds={expandedIds} onExpand={expand} hoverId={hoverId} onHoverChange={hoverFromCanvas} onHullHoverChange={setHullHoverKey} tilt={tilted ? 1 : 0} layerOrder={layerOrder} coauthorIds={coauthorIds} journalLabels={journalLabels} hiddenIds={hiddenIds} edgesOnlyForId={edgesOnlyForId} />}

        <aside className="graph-overlay graph-overlay-left">
          <GraphFiltersSidebar flags={flags} setFlag={setFlag} yearMin={yearMin} yearMax={yearMax} yearFrom={yearFrom} yearTo={yearTo} onYearRangeChange={(f, t) => setRange([f, t])} layerOrder={layerOrder} onReorderLayer={reorderLayer} layersEnabled={tilted} />
        </aside>

        <aside className="graph-overlay graph-overlay-right" ref={detailPanelRef}>
          <NodeDetail
            nodeId={selectedNodeId}
            onClose={() => pushSelection(null)}
            onBack={selectionStack.length >= 1 ? popSelection : undefined}
            accentColor={explorerSelectedColor(selectedNodeId, projectedNodes, affiliations, effectiveHomeKey, egoAuthorId)}
            navDir={navDir}
            empty={<GraphContents nodes={projectedNodes} edges={projectedEdges} allNodes={rawNodes} affiliations={affiliations} homeInstitutionId={effectiveHomeKey} egoAuthorId={egoAuthorId} coauthorIds={coauthorIds} onSelect={id => { pushSelection(id); expand(id); }} onHover={hoverFromSidebar} hoveredId={hover.source === 'canvas' ? hoverId : null} hoveredHullKey={hullHoverKey} onSearchSelect={id => pushSelection(id)} />}
          />
        </aside>
      </div>
    </div>
  );
}
