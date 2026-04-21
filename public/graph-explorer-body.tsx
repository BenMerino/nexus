import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { projectGraph } from './project-graph';
import { NodeDetail } from './node-detail';
import { ExplorerCanvas } from './explorer-canvas';
import { GraphSearch } from './graph-search';
import { useTimeRange } from './time-slider';
import { useGraphData } from './use-graph-data';
import { useCurrentUser } from './shell-helpers';
import { Tag } from './ui-primitives';
import { GraphFiltersSidebar, type NodeTypeFlags } from './graph-filters-sidebar';
import { buildExplorerAffiliations } from './explorer-affiliations';
import { useExplorerEgo } from './use-explorer-ego';
import { useExplorerNodes } from './use-explorer-nodes';
import { GraphContents } from './graph-contents';
import { explorerSelectedColor } from './explorer-selected-color';

const DEFAULT_FLAGS: NodeTypeFlags = { institution: true, author: true, coauthor: true, journal: true, paper: false };

function yearOf(n: { group: string; published?: string | null }): number {
  if (n.group !== 'doi' || !n.published) return 0;
  const y = parseInt(n.published.substring(0, 4));
  return y > 1900 ? y : 0;
}

export function GraphExplorerBody() {
  const { rawNodes, rawEdges, affiliations: authoritativeAffs, tagMeta, loading } = useGraphData();
  const [selectionStack, setSelectionStack] = useState<string[]>([]);
  const selectedNodeId = selectionStack.length ? selectionStack[selectionStack.length - 1] : null;
  const pushSelection = useCallback((id: string | null) => setSelectionStack(prev => {
    if (id === null) return [];
    if (prev.length && prev[prev.length - 1] === id) return prev;
    return [...prev, id];
  }), []);
  const popSelection = useCallback(() => setSelectionStack(prev => prev.length ? prev.slice(0, -1) : prev), []);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const expand = useCallback((id: string) => setExpandedIds(prev => {
    if (prev.has(id)) return prev;
    const n = new Set(prev); n.add(id); return n;
  }), []);
  const [flags, setFlags] = useState<NodeTypeFlags>(DEFAULT_FLAGS);
  const setFlag = useCallback((k: keyof NodeTypeFlags, v: boolean) => setFlags(f => ({ ...f, [k]: v })), []);
  const [yearFloor, setYearFloor] = useState(0);
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

  const { min: yearMin, max: yearMax } = useTimeRange(rawNodes);
  useEffect(() => { if (yearMin && !yearFloor) setYearFloor(yearMin); }, [yearMin, yearFloor]);

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

  const { nodes: projectedRaw, edges: projectedEdgesAll } = useMemo(
    () => projectGraph(filteredRaw.nodes, filteredRaw.edges, new Set(['institution', 'author', 'journal']), [], null, flags.paper),
    [filteredRaw, flags.paper]);

  const { projectedNodes } = useExplorerNodes({ projectedRaw, tagMeta, rawNodes, rawEdges, me, flags });

  const projectedEdges = useMemo(() => {
    const ids = new Set(projectedNodes.map(n => n.id));
    return projectedEdgesAll.filter(e => ids.has(e.source) && ids.has(e.target));
  }, [projectedEdgesAll, projectedNodes]);

  const affiliations = useMemo(() => buildExplorerAffiliations(rawNodes, rawEdges, authoritativeAffs), [rawNodes, rawEdges, authoritativeAffs]);

  const { egoAuthorId, effectiveHomeKey } = useExplorerEgo({
    me,
    rawNodes,
    projectedNodes,
    institutionsByAuthor: affiliations.institutionsByAuthor,
  });

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

      <div style={{ marginBottom: 12 }}><GraphSearch nodes={projectedNodes} onSelect={id => pushSelection(id)} /></div>

      <div className="graph-layout">
        <GraphFiltersSidebar flags={flags} setFlag={setFlag} yearMin={yearMin} yearMax={yearMax} yearFloor={yearFloor || yearMin} onYearFloorChange={setYearFloor} nodes={projectedNodes} allNodes={rawNodes} affiliations={affiliations} homeInstitutionId={effectiveHomeKey} />

        <div className="graph-canvas">
          <div className="canvas-corner-tl">
            <div>tenant · <em>{me?.tenant || '—'}</em></div>
            <div>role · <em>{me?.role || '—'}</em></div>
            <div>scope · {yearFloor > yearMin ? `≥ ${yearFloor}` : 'all years'}</div>
          </div>
          {projectedNodes.length === 0
            ? <div style={{ padding: 40, textAlign: 'center', position: 'relative', zIndex: 1 }} className="muted">No nodes match the current filters.</div>
            : <ExplorerCanvas nodes={projectedNodes} links={projectedEdges} affiliations={affiliations} homeInstitutionId={effectiveHomeKey} egoAuthorId={egoAuthorId} selectedId={selectedNodeId} onNodeClick={n => pushSelection(n.id)} expandedIds={expandedIds} onExpand={expand} hoverId={hoverId} />}
        </div>

        <aside className="detail-panel">
          <NodeDetail
            nodeId={selectedNodeId}
            onClose={() => pushSelection(null)}
            onBack={selectionStack.length >= 1 ? popSelection : undefined}
            accentColor={explorerSelectedColor(selectedNodeId, projectedNodes, affiliations, effectiveHomeKey, egoAuthorId)}
            empty={<GraphContents nodes={projectedNodes} affiliations={affiliations} homeInstitutionId={effectiveHomeKey} egoAuthorId={egoAuthorId} onSelect={id => { pushSelection(id); expand(id); }} onHover={setHoverId} />}
          />
        </aside>
      </div>
    </div>
  );
}
