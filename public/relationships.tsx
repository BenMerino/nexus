import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import type { RawNode, RawEdge, Category, ProjectedEdge, EnrichedSimNode } from './relationship-types';
import { TAG_CATEGORIES } from './relationship-types';
import { enrichWithMeta, type TagMetaMap } from './enrich-meta';
import { projectGraph } from './project-graph';
import { useForceLayout } from './use-force-layout';
import { CategoryStrip, TagPicker } from './graph-controls';
import { DetailPanel } from './detail-panel';
import { StatsBar, FilteredCharts } from './filtered-charts';
import { GraphCanvas } from './graph-canvas';

function RelationshipExplorer() {
  const [rawNodes, setRawNodes] = useState<RawNode[]>([]);
  const [rawEdges, setRawEdges] = useState<RawEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [tagMeta, setTagMeta] = useState<TagMetaMap>({});
  const [categoryOrder, setCategoryOrder] = useState<Category[]>([...TAG_CATEGORIES]);
  const [activeCategories, setActiveCategories] = useState<Set<Category>>(() => new Set(TAG_CATEGORIES));
  const [pinnedTags, setPinnedTags] = useState<string[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 1100, height: 600 });

  useEffect(() => {
    fetch('/api/graph').then(r => r.json())
      .then((d: { nodes: RawNode[]; edges: RawEdge[] }) => { setRawNodes(d.nodes); setRawEdges(d.edges); setLoading(false); })
      .catch(() => setLoading(false));
    fetch('/api/graph-metadata').then(r => r.json())
      .then((d: { tagMeta: typeof tagMeta }) => setTagMeta(d.tagMeta || {}))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      const { width } = entries[0].contentRect;
      if (width > 0) setDims({ width, height: Math.max(400, Math.min(700, width * 0.55)) });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const toggleCategory = useCallback((cat: Category) => {
    setActiveCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat); if (next.size === 0) return prev;
        setPinnedTags(p => { const filtered = p.filter(id => !id.startsWith(cat + ':')); return filtered.length === p.length ? p : filtered; });
      } else next.add(cat);
      return next;
    });
    setSelectedNodeId(null);
  }, []);

  const toggleTag = useCallback((id: string) => {
    setPinnedTags(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
    setSelectedNodeId(null);
  }, []);

  const reorderCategories = useCallback((from: number, to: number) => {
    setCategoryOrder(prev => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const { nodes: projectedNodesRaw, edges: projectedEdges, matchingDois } = useMemo(
    () => projectGraph(rawNodes, rawEdges, activeCategories, pinnedTags), [rawNodes, rawEdges, activeCategories, pinnedTags]);

  const projectedNodes = useMemo(() => enrichWithMeta(projectedNodesRaw, tagMeta), [projectedNodesRaw, tagMeta]);
  const doiCount = useMemo(() => rawNodes.filter(n => n.group === 'doi').length, [rawNodes]);
  const activeCatOrder = useMemo(() => categoryOrder.filter(c => activeCategories.has(c)), [categoryOrder, activeCategories]);
  const { simNodes: layoutNodes, nodesRef: simMutableRef, simRef: d3SimRef } = useForceLayout(projectedNodes, projectedEdges, dims.width, dims.height, activeCatOrder);
  const nodeMap = useMemo(() => new Map(layoutNodes.map(n => [n.id, n])), [layoutNodes]);

  const { connectedIds, edgesForNode } = useMemo(() => {
    if (!selectedNodeId) return { connectedIds: new Set<string>(), edgesForNode: [] as ProjectedEdge[] };
    const ids = new Set<string>([selectedNodeId]);
    const matching: ProjectedEdge[] = [];
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

  const { categoryCounts, tagsByCategory } = useMemo(() => {
    const counts: Record<string, number> = {};
    const doiPerTag = new Map<string, number>();
    for (const e of rawEdges) doiPerTag.set(e.target, (doiPerTag.get(e.target) || 0) + 1);
    const byCategory: Record<string, { id: string; label: string; doiCount: number }[]> = {};
    for (const n of rawNodes) {
      if (n.group === 'doi') continue;
      counts[n.group] = (counts[n.group] || 0) + 1;
      (byCategory[n.group] ||= []).push({ id: n.id, label: n.label, doiCount: doiPerTag.get(n.id) || 0 });
    }
    for (const cat of Object.keys(byCategory)) byCategory[cat].sort((a, b) => b.doiCount - a.doiCount);
    return { categoryCounts: counts, tagsByCategory: byCategory };
  }, [rawNodes, rawEdges]);

  const pinnedSet = useMemo(() => new Set(pinnedTags), [pinnedTags]);

  if (loading) return <div style={{ padding: 24, fontFamily: 'monospace', color: '#999' }}>Loading graph data...</div>;
  if (!rawNodes.length) return <div style={{ padding: 24, fontFamily: 'monospace', color: '#999' }}>No data. Submit some DOIs first.</div>;

  const [filtersVisible, setFiltersVisible] = useState(false);

  return (
    <div ref={containerRef}>
      <div style={{ marginBottom: 12 }}>
        <button onClick={() => setFiltersVisible(!filtersVisible)} style={{ background: 'none', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer', fontSize: 12, color: '#555', fontFamily: 'monospace', padding: '4px 10px' }}>
          {filtersVisible ? 'Hide Filters' : 'Filters'}{pinnedTags.length > 0 ? ` (${pinnedTags.length})` : ''}
        </button>
      </div>
      {filtersVisible && <>
        <CategoryStrip categories={categoryOrder} counts={categoryCounts} active={activeCategories} onToggle={toggleCategory} onReorder={reorderCategories} />
        <div style={{ background: '#fafafa', border: '1px solid #eee', borderRadius: 6, padding: '8px 12px', marginBottom: 12 }}>
          {categoryOrder.map(cat => { if (!activeCategories.has(cat)) return null; const tags = tagsByCategory[cat]; if (!tags?.length) return null; return <TagPicker key={cat} category={cat} tags={tags} pinnedTags={pinnedSet} pinnedOrder={pinnedTags} onToggleTag={toggleTag} />; })}
          {pinnedTags.length > 0 && <div style={{ textAlign: 'right', marginTop: 2 }}><button onClick={() => { setPinnedTags([]); setSelectedNodeId(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#999', fontFamily: 'monospace' }}>clear all filters ({pinnedTags.length})</button></div>}
        </div>
      </>}
      <div style={{ position: 'relative', border: '1px solid #ddd', borderRadius: 6, background: '#fff', overflow: 'hidden' }}>
        {projectedNodes.length === 0
          ? <div style={{ padding: 40, textAlign: 'center', color: '#999', fontFamily: 'monospace' }}>No connections for selected categories.</div>
          : <GraphCanvas dims={dims} projectedEdges={projectedEdges} layoutNodes={layoutNodes} nodeMap={nodeMap} selectedNodeId={selectedNodeId} connectedIds={connectedIds} simMutableRef={simMutableRef} d3SimRef={d3SimRef} onSelect={setSelectedNodeId} categoryOrder={activeCatOrder} />}
        {selectedNode && <DetailPanel node={selectedNode} connections={selectedConnections} edgesForNode={edgesForNode} onClose={() => setSelectedNodeId(null)} onSelectNode={id => setSelectedNodeId(id)} />}
      </div>
      <StatsBar nodes={projectedNodes} edges={projectedEdges} doiCount={doiCount} />
      <div style={{ marginTop: 16, borderTop: '1px solid #eee', paddingTop: 16 }}><FilteredCharts matchingDois={chartDois} totalDois={doiCount} /></div>
    </div>
  );
}

const root = createRoot(document.getElementById('relationships-root')!);
root.render(<RelationshipExplorer />);
