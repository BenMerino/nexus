import React, { useEffect, useMemo, useRef, useState } from 'react';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';

export interface PublicGraphNode {
  id: string;
  label: string;
  group: 'author' | 'institution';
  ext_id?: string | null;
}
export interface PublicGraphEdge {
  source: string;
  target: string;
  weight: number;
}

interface SimNode extends PublicGraphNode { x?: number; y?: number; vx?: number; vy?: number; fx?: number | null; fy?: number | null; }

const COLORS = { author: '#2e7d32', institution: '#1565c0' };

export function TenantGraph({ nodes, edges }: { nodes: PublicGraphNode[]; edges: PublicGraphEdge[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 1000, height: 520 });
  const [tick, setTick] = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);
  const simNodesRef = useRef<SimNode[]>([]);

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

  useEffect(() => {
    const sn: SimNode[] = nodes.map(n => ({ ...n }));
    const se = edges.map(e => ({ ...e }));
    simNodesRef.current = sn;
    const sim = forceSimulation(sn as any)
      .force('link', forceLink(se as any).id((n: any) => n.id).distance(80).strength(0.3))
      .force('charge', forceManyBody().strength(-180))
      .force('center', forceCenter(dims.width / 2, dims.height / 2))
      .force('collide', forceCollide(18))
      .alpha(0.8)
      .alphaDecay(0.05);
    sim.on('tick', () => setTick(t => t + 1));
    return () => { sim.stop(); };
  }, [nodes, edges, dims.width, dims.height]);

  const nodeMap = useMemo(() => new Map(simNodesRef.current.map(n => [n.id, n])), [tick]);
  const connected = useMemo(() => {
    if (!hovered) return null;
    const s = new Set<string>([hovered]);
    for (const e of edges) {
      if (e.source === hovered) s.add(e.target);
      if (e.target === hovered) s.add(e.source);
    }
    return s;
  }, [hovered, edges]);

  if (!nodes.length) return <div style={{ padding: 24, color: '#999' }}>No collaboration data yet.</div>;

  return (
    <div ref={containerRef} style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 4 }}>
      <svg width={dims.width} height={dims.height}>
        <g>
          {edges.map((e, i) => {
            const s = nodeMap.get(e.source as any); const t = nodeMap.get(e.target as any);
            if (!s || !t) return null;
            const dim = connected && !(connected.has(e.source as any) && connected.has(e.target as any));
            return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y}
              stroke="#bbb" strokeOpacity={dim ? 0.1 : 0.5} strokeWidth={Math.min(1 + Math.log(e.weight + 1), 3)} />;
          })}
        </g>
        <g>
          {simNodesRef.current.map(n => {
            const dim = connected && !connected.has(n.id);
            const r = n.group === 'institution' ? 10 : 6;
            return (
              <g key={n.id} transform={`translate(${n.x || 0}, ${n.y || 0})`}
                onMouseEnter={() => setHovered(n.id)} onMouseLeave={() => setHovered(null)}
                style={{ cursor: 'pointer', opacity: dim ? 0.25 : 1 }}>
                <circle r={r} fill={COLORS[n.group]} stroke="#fff" strokeWidth={1.5} />
                {(hovered === n.id || n.group === 'institution') && (
                  <text x={r + 4} y={4} fontSize={11} fontFamily="monospace" fill="#333">
                    {n.label.length > 32 ? n.label.slice(0, 32) + '…' : n.label}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      <div style={{ padding: '6px 12px', fontSize: 11, color: '#666', borderTop: '1px solid #eee' }}>
        <span style={{ color: COLORS.author }}>●</span> Author &nbsp;
        <span style={{ color: COLORS.institution }}>●</span> Collaborating institution &nbsp;
        <span style={{ marginLeft: 8 }}>Hover a node to highlight its connections.</span>
      </div>
    </div>
  );
}
