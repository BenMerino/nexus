import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { EnrichedSimNode, ProjectedEdge } from './relationship-types';
import { COLORS } from './relationship-types';
import { NodeGlyph } from './node-glyph';
import { EdgeDefs, EdgeLine } from './edge-render';
import { NodeCard } from './node-card';
import { PaperCard } from './paper-card';

const CARD_GROUPS = new Set(['institution', 'author', 'journal']);

export function GraphCanvas({
  dims, projectedEdges, layoutNodes, nodeMap, selectedNodeId, connectedIds,
  simMutableRef, d3SimRef, onSelect, categoryOrder, expandedJournal,
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
  expandedJournal: string | null;
}) {
  const dragRef = useRef<{ node: EnrichedSimNode; offsetX: number; offsetY: number } | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdgeIdx, setHoveredEdgeIdx] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [selectedPaper, setSelectedPaper] = useState<{ doi: string; x: number; y: number } | null>(null);

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
  const hoveredEdge = hoveredEdgeIdx !== null ? projectedEdges[hoveredEdgeIdx] : null;
  const dense = layoutNodes.length > 80;

  const pad = 60;
  const inView = (x: number, y: number) =>
    x >= -pad && x <= dims.width + pad && y >= -pad && y <= dims.height + pad;
  const visibleNodes = useMemo(() => layoutNodes.filter(n => inView(n.x, n.y)), [layoutNodes, dims.width, dims.height]);
  const visibleEdges = useMemo(() => projectedEdges.filter(e => {
    const s = nodeMap.get(e.source), t = nodeMap.get(e.target);
    return s && t && (inView(s.x, s.y) || inView(t.x, t.y));
  }), [projectedEdges, nodeMap, dims.width, dims.height]);

  const cardNodes = useMemo(() => visibleNodes.filter(n => CARD_GROUPS.has(n.group)), [visibleNodes]);

  const nonCardNodes = useMemo(() => visibleNodes.filter(n => !CARD_GROUPS.has(n.group)), [visibleNodes]);

  return (
    <div style={{ position: 'relative' }}>
      <style>{`@keyframes card-in { from { opacity: 0; transform: translate(-50%,-50%) scale(0.85); } to { opacity: 1; transform: translate(-50%,-50%) scale(1); } }
@keyframes card-expand { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <svg width={dims.width} height={dims.height} viewBox={`0 0 ${dims.width} ${dims.height}`}
        style={{ display: 'block', width: '100%', height: 'auto' }}
        onMouseMove={(e) => {
          const svg = e.currentTarget as unknown as SVGSVGElement;
          const rect = svg.getBoundingClientRect();
          setMousePos({ x: (e.clientX - rect.left) / rect.width * dims.width, y: (e.clientY - rect.top) / rect.height * dims.height });
          if (dragRef.current) onNodeDrag(e.clientX, e.clientY, svg);
        }}
        onMouseUp={() => onNodeDragEnd()} onMouseLeave={() => onNodeDragEnd()}
        onClick={(e) => { if (e.target === e.currentTarget) onSelect(null); }}>
        <EdgeDefs edges={visibleEdges} nodeMap={nodeMap} />
        {visibleEdges.map((e, i) => (
          <EdgeLine key={`${e.source}-${e.target}`} edge={e} nodeMap={nodeMap} selectedNodeId={selectedNodeId}
            connectedIds={connectedIds} hovered={hoveredEdgeIdx === i}
            onMouseEnter={() => setHoveredEdgeIdx(i)} onMouseLeave={() => setHoveredEdgeIdx(null)} />
        ))}
        {nonCardNodes.map(n => (
          <NodeGlyph key={n.id} node={n}
            highlighted={connectedIds.has(n.id) && n.id !== selectedNodeId}
            dimmed={!!selectedNodeId && !connectedIds.has(n.id)}
            selected={n.id === selectedNodeId} hovered={hoveredNodeId === n.id}
            expanded={false} showLabel dense={dense}
            pinIndex={catIndexMap.has(n.group) ? catIndexMap.get(n.group)! : null}
            onClick={() => onSelect(selectedNodeId === n.id ? null : n.id)}
            onDragStart={(e) => { const svg = (e.target as SVGElement).ownerSVGElement; if (svg) onNodeDragStart(n.id, e.clientX, e.clientY, svg); }}
            onMouseEnter={() => setHoveredNodeId(n.id)} onMouseLeave={() => setHoveredNodeId(null)} />
        ))}
      </svg>

      {/* Blur overlay when a card is hovered */}
      {hoveredNodeId && CARD_GROUPS.has(nodeMap.get(hoveredNodeId)?.group || '') && (
        <div style={{
          position: 'absolute', inset: 0,
          backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
          background: 'rgba(255,255,255,0.1)',
          pointerEvents: 'none', zIndex: 5,
        }} />
      )}

      {/* Cards as HTML overlays — real backdrop-filter glass */}
      {cardNodes.map(n => (
        <NodeCard key={n.id} node={n} cColor={COLORS[n.group] || '#666'}
          selected={n.id === selectedNodeId}
          hovered={hoveredNodeId === n.id}
          expanded={expandedJournal === n.id}
          dimmed={!!selectedNodeId && !connectedIds.has(n.id)}
          isJournal={n.group === 'journal'}
          style={{
            position: 'absolute',
            left: `${n.x / dims.width * 100}%`,
            top: `${n.y / dims.height * 100}%`,
            zIndex: (hoveredNodeId === n.id || expandedJournal === n.id) ? 10 : 1,
            animation: 'card-in 350ms ease-out',
          }}
          onSelectPaper={(doi) => setSelectedPaper({ doi, x: n.x / dims.width * 100, y: n.y / dims.height * 100 })}
          handlers={{
            onClick: () => onSelect(selectedNodeId === n.id ? null : n.id),
            onMouseEnter: () => setHoveredNodeId(n.id),
            onMouseLeave: () => setHoveredNodeId(null),
          }} />
      ))}

      {selectedPaper && (
        <PaperCard doi={selectedPaper.doi} onClose={() => setSelectedPaper(null)}
          style={{ position: 'absolute', left: `calc(${selectedPaper.x}% + 140px)`, top: `${selectedPaper.y}%`, transform: 'translateY(-50%)' }} />
      )}
    </div>
  );
}
