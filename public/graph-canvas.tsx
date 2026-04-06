import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { EnrichedSimNode, ProjectedEdge } from './relationship-types';
import { NodeGlyph } from './node-glyph';
import { EdgeDefs, EdgeLine } from './edge-render';
import { ClusterHulls } from './cluster-hulls';
import { HoverCard } from './hover-card';

export function GraphCanvas({
  dims, projectedEdges, layoutNodes, nodeMap, selectedNodeId, connectedIds,
  simMutableRef, d3SimRef, onSelect, categoryOrder,
}: {
  dims: { width: number; height: number };
  projectedEdges: ProjectedEdge[];
  layoutNodes: EnrichedSimNode[];
  nodeMap: Map<string, EnrichedSimNode>;
  selectedNodeId: string | null;
  connectedIds: Set<string>;
  simMutableRef: React.MutableRefObject<EnrichedSimNode[]>;
  d3SimRef: React.MutableRefObject<any>;
  onSelect: (id: string | null) => void;
  categoryOrder: string[];
}) {
  const dragRef = useRef<{ node: EnrichedSimNode; offsetX: number; offsetY: number } | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdgeIdx, setHoveredEdgeIdx] = useState<number | null>(null);

  const onNodeDragStart = useCallback((nodeId: string, clientX: number, clientY: number, svgEl: SVGSVGElement) => {
    const node = simMutableRef.current.find((n) => n.id === nodeId);
    if (!node) return;
    const rect = svgEl.getBoundingClientRect();
    node.fx = node.x; node.fy = node.y;
    dragRef.current = { node, offsetX: node.x - (clientX - rect.left) / rect.width * dims.width, offsetY: node.y - (clientY - rect.top) / rect.height * dims.height };
    if (d3SimRef.current) d3SimRef.current.alphaTarget(0.3).restart();
  }, [simMutableRef, d3SimRef, dims]);

  const onNodeDrag = useCallback((clientX: number, clientY: number, svgEl: SVGSVGElement) => {
    const drag = dragRef.current;
    if (!drag) return;
    const rect = svgEl.getBoundingClientRect();
    drag.node.fx = (clientX - rect.left) / rect.width * dims.width + drag.offsetX;
    drag.node.fy = (clientY - rect.top) / rect.height * dims.height + drag.offsetY;
  }, [dims]);

  const onNodeDragEnd = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    drag.node.fx = null; drag.node.fy = null; dragRef.current = null;
    if (d3SimRef.current) d3SimRef.current.alphaTarget(0);
  }, [d3SimRef]);

  const catIndexMap = useMemo(() => new Map(categoryOrder.map((cat, i) => [cat, i])), [categoryOrder]);
  const hoveredNode = hoveredNodeId ? nodeMap.get(hoveredNodeId) : null;
  const hoveredEdge = hoveredEdgeIdx !== null ? projectedEdges[hoveredEdgeIdx] : null;

  return (
    <svg width={dims.width} height={dims.height} viewBox={`0 0 ${dims.width} ${dims.height}`}
      style={{ display: 'block', width: '100%', height: 'auto' }}
      onMouseMove={(e) => { if (dragRef.current) onNodeDrag(e.clientX, e.clientY, e.currentTarget as unknown as SVGSVGElement); }}
      onMouseUp={() => onNodeDragEnd()} onMouseLeave={() => onNodeDragEnd()}
      onClick={(e) => { if (e.target === e.currentTarget) onSelect(null); }}>
      <EdgeDefs edges={projectedEdges} nodeMap={nodeMap} />
      <ClusterHulls layoutNodes={layoutNodes} />
      {projectedEdges.map((e, i) => (
        <EdgeLine key={i} edge={e} nodeMap={nodeMap} selectedNodeId={selectedNodeId}
          connectedIds={connectedIds} hovered={hoveredEdgeIdx === i}
          onMouseEnter={() => setHoveredEdgeIdx(i)} onMouseLeave={() => setHoveredEdgeIdx(null)} />
      ))}
      {layoutNodes.map(n => (
        <NodeGlyph key={n.id} node={n}
          highlighted={connectedIds.has(n.id) && n.id !== selectedNodeId}
          dimmed={!!selectedNodeId && !connectedIds.has(n.id)}
          selected={n.id === selectedNodeId}
          hovered={hoveredNodeId === n.id}
          pinIndex={catIndexMap.has(n.group) ? catIndexMap.get(n.group)! : null}
          onClick={() => onSelect(selectedNodeId === n.id ? null : n.id)}
          onDragStart={(e) => { const svg = (e.target as SVGElement).ownerSVGElement; if (svg) onNodeDragStart(n.id, e.clientX, e.clientY, svg); }}
          onMouseEnter={() => setHoveredNodeId(n.id)}
          onMouseLeave={() => setHoveredNodeId(null)} />
      ))}
      <HoverCard hoveredNode={hoveredNode} hoveredEdge={hoveredEdge} nodeMap={nodeMap}
        projectedEdges={projectedEdges} dims={dims} />
    </svg>
  );
}
