import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { projectGraph } from './project-graph';
import { NodeDetail, prefetchNodeDetail } from './node-detail';
import { ExplorerCanvas } from './explorer-canvas';
import { useGraphData } from './use-graph-data';
import { useCurrentUser } from './shell-helpers';
import { buildExplorerAffiliations } from './explorer-affiliations';
import { useExplorerEgo } from './use-explorer-ego';
import { useExplorerNodes } from './use-explorer-nodes';
import { GraphContents } from './graph-contents';
import { explorerSelectedColor } from './explorer-selected-color';
import { useSelectionStack } from './use-selection-stack';
import { DEFAULT_LAYER_ORDER } from './explorer-layers';

export function GraphExplorerBody() {
  const { rawNodes, rawEdges, affiliations: authoritativeAffs, tagMeta, loading } = useGraphData();
  const { selectionStack, selectedNodeId, navDir, pushSelection, popSelection } = useSelectionStack();
  const detailPanelRef = useRef<HTMLElement>(null);
  const [hover, setHover] = useState<{ id: string | null; source: 'canvas' | 'sidebar' }>({ id: null, source: 'canvas' });
  const hoverId = hover.id;
  const prefetchTimer = useRef<number | null>(null);
  const releaseTimer = useRef<number | null>(null);
  const schedulePrefetch = useCallback((id: string | null) => {
    if (prefetchTimer.current) { clearTimeout(prefetchTimer.current); prefetchTimer.current = null; }
    if (id) prefetchTimer.current = window.setTimeout(() => prefetchNodeDetail(id), 120);
  }, []);
  // Canvas hover holds onto the last id briefly when leaving empty space, so
  // the zoom transition doesn't release the moment the cursor falls off the
  // shifting node. A new hover snaps immediately; null hover only commits
  // after the debounce expires.
  const hoverFromCanvas = useCallback((id: string | null) => {
    if (releaseTimer.current) { clearTimeout(releaseTimer.current); releaseTimer.current = null; }
    if (id) {
      setHover({ id, source: 'canvas' });
      schedulePrefetch(id);
    } else {
      releaseTimer.current = window.setTimeout(() => setHover({ id: null, source: 'canvas' }), 250);
    }
  }, [schedulePrefetch]);
  const hoverFromSidebar = useCallback((id: string | null) => setHover({ id, source: 'sidebar' }), []);
  const [hullHoverKey, setHullHoverKey] = useState<string | null>(null);
  const [sidebarHullKey, setSidebarHullKey] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const expand = useCallback((id: string) => setExpandedIds(prev => {
    if (prev.has(id)) return prev;
    const n = new Set(prev); n.add(id); return n;
  }), []);
  const layerOrder = DEFAULT_LAYER_ORDER;
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

  const { nodes: projectedRaw, edges: projectedEdgesAll } = useMemo(
    () => projectGraph(rawNodes, rawEdges, new Set(['institution', 'author', 'journal']), [], null, true),
    [rawNodes, rawEdges]);

  const { projectedNodes, coauthorIds } = useExplorerNodes({ projectedRaw, tagMeta, rawNodes, rawEdges, me });

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

  if (loading) return <div className="view"><div className="eyebrow">Loading graph data…</div></div>;
  if (!rawNodes.length) return <div className="view"><div className="eyebrow">No data.</div></div>;

  return (
    <div className="graph-view fullbleed">
      <div className="graph-canvas fullbleed">

        {projectedNodes.length === 0
          ? <div style={{ padding: 40, textAlign: 'center', position: 'relative', zIndex: 1 }} className="muted">No nodes match the current filters.</div>
          : <ExplorerCanvas nodes={projectedNodes} links={projectedEdges} affiliations={affiliations} homeInstitutionId={effectiveHomeKey} egoAuthorId={egoAuthorId} selectedId={selectedNodeId} onNodeClick={n => pushSelection(n.id)} expandedIds={expandedIds} onExpand={expand} hoverId={hoverId} onHoverChange={hoverFromCanvas} onHullHoverChange={setHullHoverKey} tilt={1} layerOrder={layerOrder} coauthorIds={coauthorIds} journalLabels={journalLabels} externalHullKey={sidebarHullKey} />}

        {selectedNodeId && (
          <aside className="graph-overlay graph-overlay-right" ref={detailPanelRef}>
            <NodeDetail
              nodeId={selectedNodeId}
              onClose={() => pushSelection(null)}
              onBack={selectionStack.length >= 1 ? popSelection : undefined}
              accentColor={explorerSelectedColor(selectedNodeId, projectedNodes, affiliations, effectiveHomeKey, egoAuthorId)}
              navDir={navDir}
            />
          </aside>
        )}

        <div className="graph-overlay graph-overlay-bottom">
          <GraphContents nodes={projectedNodes} edges={projectedEdges} allNodes={rawNodes} affiliations={affiliations} homeInstitutionId={effectiveHomeKey} egoAuthorId={egoAuthorId} coauthorIds={coauthorIds} onSelect={id => { pushSelection(id); expand(id); }} onHover={hoverFromSidebar} onHullHover={setSidebarHullKey} hoveredId={hover.source === 'canvas' ? hoverId : null} hoveredHullKey={hullHoverKey} onSearchSelect={id => pushSelection(id)} />
        </div>
      </div>
    </div>
  );
}
