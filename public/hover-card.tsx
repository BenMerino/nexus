import React from 'react';
import type { EnrichedSimNode, ProjectedEdge } from './relationship-types';
import { COLORS, BG_COLORS, communityColor, communityBg } from './relationship-types';

function NodeHoverCard({ node, edges }: { node: EnrichedSimNode; edges: ProjectedEdge[] }) {
  const topConns = edges
    .map(e => ({ id: e.source === node.id ? e.target : e.source, weight: e.weight }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3);

  return (
    <div style={{
      background: 'rgba(255,255,255,0.45)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      border: `1px solid rgba(255,255,255,0.6)`, borderRadius: 8,
      padding: '8px 12px', fontFamily: 'monospace', fontSize: 11, minWidth: 160,
      boxShadow: '0 4px 16px rgba(0,0,0,0.08)', pointerEvents: 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{
          fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5,
          color: COLORS[node.group], background: BG_COLORS[node.group],
          padding: '1px 6px', borderRadius: 3,
        }}>{node.group}</span>
        <span style={{
          fontSize: 9, letterSpacing: 0.5,
          color: communityColor(node.community), background: communityBg(node.community),
          padding: '1px 6px', borderRadius: 3,
        }}>C{node.community + 1}</span>
        <strong style={{ fontSize: 12 }}>{node.label}</strong>
      </div>
      {node.ext_id && (
        <div style={{ color: '#555', fontSize: 10, marginBottom: 4 }}>
          {node.group === 'journal' ? 'ISSN-L' : node.group === 'author' ? 'ORCID' : 'ROR'}: {node.ext_id}
        </div>
      )}
      <div style={{ color: '#777', fontSize: 10, marginBottom: 4 }}>
        {node.doiCount} paper{node.doiCount !== 1 ? 's' : ''} · {node.degree} connections
      </div>
      {node.topKeywords && node.topKeywords.length > 0 && (
        <div style={{ color: '#555', fontSize: 10, marginBottom: 4, fontStyle: 'italic' }}>
          {node.topKeywords.join(', ')}
        </div>
      )}
      {topConns.length > 0 && (
        <div style={{ borderTop: '1px solid #eee', paddingTop: 4, fontSize: 10 }}>
          {topConns.map(c => (
            <div key={c.id} style={{ color: '#555' }}>
              {c.id.replace(/^[^:]+:/, '')} <span style={{ color: '#aaa' }}>({c.weight})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EdgeHoverCard({ edge, nodeMap }: { edge: ProjectedEdge; nodeMap: Map<string, EnrichedSimNode> }) {
  const s = nodeMap.get(edge.source);
  const t = nodeMap.get(edge.target);
  return (
    <div style={{
      background: 'rgba(255,255,255,0.45)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.6)', borderRadius: 8,
      padding: '8px 12px', fontFamily: 'monospace', fontSize: 11, minWidth: 180,
      boxShadow: '0 4px 16px rgba(0,0,0,0.08)', pointerEvents: 'none',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 11 }}>
        {s?.label || edge.source} ↔ {t?.label || edge.target}
      </div>
      <div style={{ color: '#777', fontSize: 10, marginBottom: 4 }}>
        {edge.weight} shared paper{edge.weight !== 1 ? 's' : ''}
      </div>
      {edge.sharedDois.slice(0, 5).map((d, i) => (
        <div key={i} style={{ fontSize: 10, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>
          {d}
        </div>
      ))}
      {edge.sharedDois.length > 5 && (
        <div style={{ fontSize: 10, color: '#999' }}>+{edge.sharedDois.length - 5} more</div>
      )}
    </div>
  );
}

export function HoverCard({ hoveredNode, hoveredEdge, nodeMap, projectedEdges, dims, mousePos }: {
  hoveredNode: EnrichedSimNode | null | undefined;
  hoveredEdge: ProjectedEdge | null;
  nodeMap: Map<string, EnrichedSimNode>;
  projectedEdges: ProjectedEdge[];
  dims: { width: number; height: number };
  mousePos?: { x: number; y: number };
}) {
  if (!hoveredNode && !hoveredEdge) return null;

  let x = mousePos ? mousePos.x + 16 : 0;
  let y = mousePos ? mousePos.y - 10 : 0;

  if (!mousePos) {
    if (hoveredNode) { x = hoveredNode.x + 20; y = hoveredNode.y - 10; }
    else if (hoveredEdge) {
      const s = nodeMap.get(hoveredEdge.source);
      const t = nodeMap.get(hoveredEdge.target);
      if (s && t) { x = (s.x + t.x) / 2 + 10; y = (s.y + t.y) / 2 - 10; }
    }
  }

  // Clamp to viewport
  x = Math.min(x, dims.width - 220);
  y = Math.max(10, Math.min(y, dims.height - 120));

  const nodeEdges = hoveredNode
    ? projectedEdges.filter(e => e.source === hoveredNode.id || e.target === hoveredNode.id)
    : [];

  return (
    <foreignObject x={x} y={y} width={260} height={200} style={{ overflow: 'visible', pointerEvents: 'none', transition: 'x 120ms ease-out, y 120ms ease-out' }}>
      <div xmlns="http://www.w3.org/1999/xhtml">
        {hoveredNode && <NodeHoverCard node={hoveredNode} edges={nodeEdges} />}
        {hoveredEdge && !hoveredNode && <EdgeHoverCard edge={hoveredEdge} nodeMap={nodeMap} />}
      </div>
    </foreignObject>
  );
}
