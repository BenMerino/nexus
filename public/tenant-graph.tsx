import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { RawNode, RawEdge, Category, EnrichedSimNode, ProjectedEdge } from './relationship-types';
import { projectGraph } from './project-graph';
import { useForceLayout } from './use-force-layout';
import { GraphCanvas } from './graph-canvas';

const DEFAULT_CATEGORIES: Category[] = ['institution', 'author', 'journal'];

export function TenantGraph({ nodes, edges }: { nodes: RawNode[]; edges: RawEdge[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 1100, height: 560 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      const { width } = entries[0].contentRect;
      if (width > 0) setDims(prev => ({ ...prev, width }));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const activeCategories = useMemo(() => new Set<Category>(DEFAULT_CATEGORIES), []);

  const { nodes: projectedNodes, edges: projectedEdges } = useMemo(
    () => projectGraph(nodes, edges, activeCategories, [], null),
    [nodes, edges, activeCategories],
  );

  const { simNodes: layoutNodes, nodesRef, simRef } = useForceLayout(
    projectedNodes, projectedEdges, dims.width, dims.height,
  );
  const nodeMap = useMemo(() => new Map(layoutNodes.map(n => [n.id, n])), [layoutNodes]);

  const { connectedIds } = useMemo(() => {
    if (!selectedNodeId) return { connectedIds: new Set<string>() };
    const ids = new Set<string>([selectedNodeId]);
    for (const e of projectedEdges) {
      if (e.source === selectedNodeId) ids.add(e.target);
      if (e.target === selectedNodeId) ids.add(e.source);
    }
    return { connectedIds: ids };
  }, [selectedNodeId, projectedEdges]);

  if (!projectedNodes.length) {
    return <div style={{ padding: 24, color: '#999' }}>No collaboration data yet.</div>;
  }

  return (
    <div ref={containerRef}>
      <GraphCanvas
        dims={dims}
        projectedEdges={projectedEdges as ProjectedEdge[]}
        layoutNodes={layoutNodes as EnrichedSimNode[]}
        nodeMap={nodeMap as Map<string, EnrichedSimNode>}
        selectedNodeId={selectedNodeId}
        connectedIds={connectedIds}
        highlightedIds={new Set()}
        simMutableRef={nodesRef}
        d3SimRef={simRef}
        onSelect={setSelectedNodeId}
        categoryOrder={DEFAULT_CATEGORIES}
        expandedJournal={null}
      />
    </div>
  );
}
