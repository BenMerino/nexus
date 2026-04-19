import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { ProjectedEdge, EnrichedSimNode } from './relationship-types';
import { enrichWithMeta } from './enrich-meta';
import { projectGraph } from './project-graph';
import { useForceLayout } from './use-force-layout';
import { useFilterState } from './use-filter-state';
import { CategoryStrip, TagPicker } from './graph-controls';
import { DetailPanel } from './detail-panel';
import { StatsBar, FilteredCharts } from './filtered-charts';
import { GraphCanvas } from './graph-canvas';
import { GraphSearch } from './graph-search';
import { GraphLegend } from './graph-legend';
import { useTagCounts } from './use-tag-counts';
import { TimeSlider, useTimeRange, useTimeFilter } from './time-slider';
import { useGraphData } from './use-graph-data';
import { useCurrentUser } from './shell-helpers';
import { Tag } from './ui-primitives';

export function GraphExplorerBody() {
  const { rawNodes, rawEdges, tagMeta, loading } = useGraphData();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [expandedJournal, setExpandedJournal] = useState<string | null>(null);
  const [maxYear, setMaxYear] = useState(new Date().getFullYear());
  const highlightedIds = useMemo(() => {
    const o = new URLSearchParams(window.location.search).get('highlight');
    return o ? new Set([`author:${o}`]) : new Set<string>();
  }, []);
  const { me } = useCurrentUser();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 1100, height: 600 });
  const { categoryOrder, activeCategories, pinnedTags, filtersVisible, setFiltersVisible, toggleCategory, toggleTag, reorderCategories } = useFilterState();

  useEffect(() => {
    if (!rawNodes.length) return;
    const f = highlightedIds.values().next().value;
    if (f && rawNodes.some(n => n.id === f)) setSelectedNodeId(f);
  }, [rawNodes, highlightedIds]);

  const jCount = rawNodes.filter(n => n.group === 'journal').length;
  const baseHeight = Math.max(500, 120 + (Math.ceil(jCount / 4) + (expandedJournal ? 3 : 0)) * 80);

  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    setDims(prev => ({ ...prev, height: baseHeight }));
    const obs = new ResizeObserver(entries => {
      const { width } = entries[0].contentRect;
      if (width > 0) setDims({ width, height: baseHeight });
    });
    obs.observe(el); return () => obs.disconnect();
  }, [baseHeight]);

  const handleSelect = useCallback((id: string | null) => {
    if (id && rawNodes.find(n => n.id === id)?.group === 'journal') {
      setExpandedJournal(prev => prev === id ? null : id); setSelectedNodeId(null); return;
    }
    setSelectedNodeId(id);
  }, [rawNodes]);

  const { min: yearMin, max: yearMax } = useTimeRange(rawNodes);
  const sliderActive = yearMax > 0 && maxYear < yearMax;
  const { nodes: timeNodes, edges: timeEdges } = useTimeFilter(rawNodes, rawEdges, sliderActive ? maxYear : 0);
  const { nodes: projectedNodesRaw, edges: projectedEdges, matchingDois } = useMemo(
    () => projectGraph(sliderActive ? timeNodes : rawNodes, sliderActive ? timeEdges : rawEdges, activeCategories, pinnedTags, null),
    [sliderActive, timeNodes, timeEdges, rawNodes, rawEdges, activeCategories, pinnedTags]);

  const totalCounts = useMemo(() => {
    const c = new Map<string, number>();
    for (const e of rawEdges) c.set(e.target, (c.get(e.target) || 0) + 1);
    return c;
  }, [rawEdges]);
  const projectedNodes = useMemo(() => enrichWithMeta(projectedNodesRaw, tagMeta).map(n => ({
    ...n, weight: totalCounts.get(n.id) || n.weight, doiCount: totalCounts.get(n.id) || n.doiCount,
  })), [projectedNodesRaw, tagMeta, totalCounts]);
  const doiCount = useMemo(() => rawNodes.filter(n => n.group === 'doi').length, [rawNodes]);
  const { simNodes: layoutNodes, nodesRef: simMutableRef, simRef: d3SimRef } = useForceLayout(projectedNodes, projectedEdges, dims.width, dims.height);
  const nodeMap = useMemo(() => new Map(layoutNodes.map(n => [n.id, n])), [layoutNodes]);
  const { connectedIds, edgesForNode } = useMemo(() => {
    if (!selectedNodeId) return { connectedIds: new Set<string>(), edgesForNode: [] as ProjectedEdge[] };
    const ids = new Set<string>([selectedNodeId]); const matching: ProjectedEdge[] = [];
    for (const e of projectedEdges) {
      if (e.source === selectedNodeId) { ids.add(e.target); matching.push(e); }
      if (e.target === selectedNodeId) { ids.add(e.source); matching.push(e); }
    }
    return { connectedIds: ids, edgesForNode: matching };
  }, [selectedNodeId, projectedEdges]);

  const selectedNode = selectedNodeId ? nodeMap.get(selectedNodeId) : null;
  const selectedConnections = useMemo(() => {
    if (!selectedNodeId) return [];
    return [...connectedIds].filter(id => id !== selectedNodeId).map(id => nodeMap.get(id)).filter(Boolean) as EnrichedSimNode[];
  }, [selectedNodeId, connectedIds, nodeMap]);

  const chartDois = useMemo(() => {
    if (!selectedNodeId) return matchingDois;
    const nodeDois = new Set<string>();
    for (const e of rawEdges) if (e.target === selectedNodeId) { const doi = e.source.replace('doi:', ''); if (matchingDois.has(doi)) nodeDois.add(doi); }
    return nodeDois;
  }, [selectedNodeId, rawEdges, matchingDois]);

  const { categoryCounts, tagsByCategory } = useTagCounts(rawNodes, rawEdges);
  const pinnedSet = useMemo(() => new Set(pinnedTags), [pinnedTags]);

  if (loading) return <div className="view"><div className="eyebrow">Loading graph data…</div></div>;
  if (!rawNodes.length) return <div className="view"><div className="eyebrow">No data.</div></div>;

  return (
    <div className="view graph-view">
      <header className="view-head compact">
        <div>
          <div className="eyebrow">Graph explorer</div>
          <h1 className="view-title tight">The institution as a <em>network</em>.</h1>
        </div>
        <div className="view-meta">
          <Tag mono>{projectedNodes.length} NODES</Tag>
          <Tag mono tone="muted">{projectedEdges.length} EDGES</Tag>
        </div>
      </header>

      <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={() => setFiltersVisible(!filtersVisible)}>
          {filtersVisible ? 'Hide filters' : 'Filters'}{pinnedTags.length > 0 ? ` (${pinnedTags.length})` : ''}
        </button>
        <GraphSearch nodes={projectedNodes} onSelect={handleSelect} />
        <GraphLegend />
        <TimeSlider min={yearMin} max={yearMax} value={maxYear} onChange={setMaxYear} />
      </div>
      {filtersVisible && <>
        <CategoryStrip categories={categoryOrder} counts={categoryCounts} active={activeCategories} onToggle={toggleCategory} onReorder={reorderCategories} />
        <div className="card" style={{ padding: '8px 12px', marginBottom: 12 }}>
          {categoryOrder.map(cat => { if (!activeCategories.has(cat)) return null; const tags = tagsByCategory[cat]; if (!tags?.length) return null; return <TagPicker key={cat} category={cat} tags={tags} pinnedTags={pinnedSet} pinnedOrder={pinnedTags} onToggleTag={toggleTag} />; })}
        </div>
      </>}
      <div ref={containerRef} style={{ position: 'relative', background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        <div className="canvas-corner-tl">
          <div>tenant · <em>{me?.tenant || '—'}</em></div>
          <div>role · <em>{me?.role || '—'}</em></div>
          <div>scope · {sliderActive ? `≤ ${maxYear}` : 'all years'}</div>
        </div>
        {projectedNodes.length === 0
          ? <div style={{ padding: 40, textAlign: 'center' }} className="muted">No data.</div>
          : <GraphCanvas dims={dims} projectedEdges={projectedEdges} layoutNodes={layoutNodes} nodeMap={nodeMap} selectedNodeId={selectedNodeId} connectedIds={connectedIds} highlightedIds={highlightedIds} simMutableRef={simMutableRef} d3SimRef={d3SimRef} onSelect={handleSelect} categoryOrder={categoryOrder.filter(c => activeCategories.has(c))} expandedJournal={expandedJournal} />}
        {selectedNode && <DetailPanel node={selectedNode} connections={selectedConnections} edgesForNode={edgesForNode} onClose={() => setSelectedNodeId(null)} onSelectNode={id => setSelectedNodeId(id)} />}
      </div>
      <StatsBar nodes={projectedNodes} edges={projectedEdges} doiCount={doiCount} />
      <div style={{ marginTop: 20, borderTop: '1px solid var(--border-soft)', paddingTop: 20 }}><FilteredCharts matchingDois={chartDois} totalDois={doiCount} /></div>
    </div>
  );
}
