import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { EnrichedSimNode } from './relationship-types';
import { enrichWithMeta } from './enrich-meta';
import { projectGraph } from './project-graph';
import { NodeDetail } from './node-detail';
import { StatsBar, FilteredCharts } from './filtered-charts';
import { CoauthorCanvas } from './coauthor-canvas';
import { useCoauthorGraph } from './use-coauthor-graph';
import { GraphSearch } from './graph-search';
import { useTimeRange } from './time-slider';
import { useGraphData } from './use-graph-data';
import { useCurrentUser } from './shell-helpers';
import { Tag } from './ui-primitives';
import { GraphFiltersSidebar, type NodeTypeFlags } from './graph-filters-sidebar';
import { buildExplorerAffiliations } from './explorer-affiliations';
import { useExplorerEgo } from './use-explorer-ego';

const DEFAULT_FLAGS: NodeTypeFlags = { institution: true, author: true, journal: true, paper: false };

function yearOf(n: { group: string; published?: string | null }): number {
  if (n.group !== 'doi' || !n.published) return 0;
  const y = parseInt(n.published.substring(0, 4));
  return y > 1900 ? y : 0;
}

export function GraphExplorerBody() {
  const { rawNodes, rawEdges, tagMeta, loading } = useGraphData();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [flags, setFlags] = useState<NodeTypeFlags>(DEFAULT_FLAGS);
  const setFlag = useCallback((k: keyof NodeTypeFlags, v: boolean) => setFlags(f => ({ ...f, [k]: v })), []);
  const [yearFloor, setYearFloor] = useState(0);
  const highlightedIds = useMemo(() => {
    const o = new URLSearchParams(window.location.search).get('highlight');
    return o ? new Set([`author:${o}`]) : new Set<string>();
  }, []);
  const { me } = useCurrentUser();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 900, height: 600 });
  const coauthorGraph = useCoauthorGraph();

  useEffect(() => {
    if (!rawNodes.length) return;
    const f = highlightedIds.values().next().value;
    if (f && rawNodes.some(n => n.id === f)) setSelectedNodeId(f);
  }, [rawNodes, highlightedIds]);

  const { min: yearMin, max: yearMax } = useTimeRange(rawNodes);
  useEffect(() => { if (yearMin && !yearFloor) setYearFloor(yearMin); }, [yearMin, yearFloor]);

  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const obs = new ResizeObserver(entries => {
      const r = entries[0].contentRect;
      if (r.width > 0 && r.height > 0) setDims({ width: r.width, height: r.height });
    });
    obs.observe(el);
    const r = el.getBoundingClientRect();
    if (r.width > 0) setDims({ width: r.width, height: r.height });
    return () => obs.disconnect();
  }, []);

  const filteredRaw = useMemo(() => {
    if (!yearFloor || yearFloor <= yearMin) return { nodes: rawNodes, edges: rawEdges };
    const keep = new Set<string>();
    const nodes = rawNodes.filter(n => {
      if (n.group !== 'doi') return true;
      const y = yearOf(n); const ok = !y || y >= yearFloor;
      if (ok) keep.add(n.id); return ok;
    });
    const edges = rawEdges.filter(e => !e.source.startsWith('doi:') || keep.has(e.source));
    return { nodes, edges };
  }, [rawNodes, rawEdges, yearFloor, yearMin]);

  const { nodes: projectedRaw, edges: projectedEdgesAll, matchingDois } = useMemo(
    () => projectGraph(filteredRaw.nodes, filteredRaw.edges, new Set(['institution', 'author', 'journal']), [], null),
    [filteredRaw]);

  const projectedNodes = useMemo(() => {
    const enriched = enrichWithMeta(projectedRaw, tagMeta);
    const groupMatch = (g: string) => (g === 'institution' && flags.institution) || (g === 'author' && flags.author) || (g === 'journal' && flags.journal) || (g === 'doi' && flags.paper);
    return enriched.filter(n => groupMatch(n.group)) as EnrichedSimNode[];
  }, [projectedRaw, tagMeta, flags]);

  const projectedEdges = useMemo(() => {
    const ids = new Set(projectedNodes.map(n => n.id));
    return projectedEdgesAll.filter(e => ids.has(e.source) && ids.has(e.target));
  }, [projectedEdgesAll, projectedNodes]);

  const doiCount = useMemo(() => rawNodes.filter(n => n.group === 'doi').length, [rawNodes]);

  const affiliations = useMemo(() => buildExplorerAffiliations(rawNodes, rawEdges), [rawNodes, rawEdges]);

  const { egoAuthorId, effectiveHomeKey } = useExplorerEgo({
    me,
    rawNodes,
    projectedNodes,
    institutionsByAuthor: affiliations.institutionsByAuthor,
  });

  const chartDois = useMemo(() => {
    if (!selectedNodeId) return matchingDois;
    const nodeDois = new Set<string>();
    for (const e of rawEdges) if (e.target === selectedNodeId) { const doi = e.source.replace('doi:', ''); if (matchingDois.has(doi)) nodeDois.add(doi); }
    return nodeDois;
  }, [selectedNodeId, rawEdges, matchingDois]);

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

      <div style={{ marginBottom: 12 }}><GraphSearch nodes={projectedNodes} onSelect={id => setSelectedNodeId(id)} /></div>

      <div className="graph-layout">
        <GraphFiltersSidebar flags={flags} setFlag={setFlag} yearMin={yearMin} yearMax={yearMax} yearFloor={yearFloor || yearMin} onYearFloorChange={setYearFloor} nodes={projectedNodes} affiliations={affiliations} homeInstitutionId={effectiveHomeKey} />

        <div ref={containerRef} className="graph-canvas">
          <div className="canvas-corner-tl">
            <div>tenant · <em>{me?.tenant || '—'}</em></div>
            <div>role · <em>{me?.role || '—'}</em></div>
            <div>scope · {yearFloor > yearMin ? `≥ ${yearFloor}` : 'all years'}</div>
          </div>
          {!coauthorGraph
            ? <div style={{ padding: 40, textAlign: 'center', position: 'relative', zIndex: 1 }} className="muted">Loading co-author network…</div>
            : coauthorGraph.nodes.length < 2
              ? <div style={{ padding: 40, textAlign: 'center', position: 'relative', zIndex: 1 }} className="muted">No co-authors yet.</div>
              : <CoauthorCanvas graph={coauthorGraph} onNodeClick={n => setSelectedNodeId(n.id)} />}
        </div>

        <aside className="detail-panel">
          <NodeDetail nodeId={selectedNodeId} onClose={() => setSelectedNodeId(null)} />
        </aside>
      </div>

      <StatsBar nodes={projectedNodes} edges={projectedEdges} doiCount={doiCount} />
      <div style={{ marginTop: 20, borderTop: '1px solid var(--border-soft)', paddingTop: 20 }}><FilteredCharts matchingDois={chartDois} totalDois={doiCount} /></div>
    </div>
  );
}
