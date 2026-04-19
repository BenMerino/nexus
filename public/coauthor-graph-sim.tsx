import React, { useEffect, useMemo, useRef, useState } from 'react';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceX, forceY, type Simulation } from 'd3-force';
import type { CoauthorGraph, CoauthorNode, CoauthorEdge } from './dashboard-builders.js';

type SimN = CoauthorNode & { x: number; y: number; fx?: number | null; fy?: number | null };
type SimL = CoauthorEdge & { source: SimN | string; target: SimN | string };

function radius(n: CoauthorNode) { return n.isMe ? 12 : 5 + Math.min(10, Math.sqrt(n.weight) * 1.5); }

export const COMMUNITY_PALETTE = ['#6ba4d6', '#b57ad1', '#8fcb9b', '#d68a6b', '#d1c57a', '#c67ad1', '#6bd6c5', '#d66b8a', '#7a8ed1', '#b0b0b0'];
export function buildCommunityColors(nodes: CoauthorNode[], myRor: string | null) {
  const counts = new Map<string, number>();
  for (const n of nodes) {
    if (n.isMe || !n.affiliation?.ror || n.affiliation.ror === myRor) continue;
    counts.set(n.affiliation.ror, (counts.get(n.affiliation.ror) || 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const map = new Map<string, string>();
  sorted.forEach(([ror], i) => map.set(ror, COMMUNITY_PALETTE[i % COMMUNITY_PALETTE.length]));
  return map;
}

export function CoAuthorSim({ graph, width, height }: { graph: CoauthorGraph; width: number; height: number }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const simRef = useRef<Simulation<SimN, SimL> | null>(null);
  const [, tick] = useState(0);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const myRor = graph.nodes.find(n => n.isMe)?.affiliation?.ror || null;
  const communityColors = useMemo(() => buildCommunityColors(graph.nodes, myRor), [graph, myRor]);
  const nodeColor = (n: CoauthorNode) => n.isMe ? 'var(--accent)' : !n.affiliation?.ror ? 'var(--fg-dim)' : n.affiliation.ror === myRor ? 'var(--fg-muted)' : (communityColors.get(n.affiliation.ror) || 'var(--fg-dim)');

  const { nodes, links } = useMemo(() => {
    const ns: SimN[] = graph.nodes.map(n => ({
      ...n,
      x: width / 2 + (Math.random() - 0.5) * width * 0.5,
      y: height / 2 + (Math.random() - 0.5) * height * 0.5,
      fx: n.isMe ? width / 2 : null,
      fy: n.isMe ? height / 2 : null,
    }));
    const nmap = new Map(ns.map(n => [n.id, n]));
    const ls: SimL[] = graph.edges.filter(e => nmap.has(e.source) && nmap.has(e.target)).map(e => ({ ...e }));
    return { nodes: ns, links: ls };
  }, [graph, width, height]);

  useEffect(() => {
    const sim = forceSimulation<SimN, SimL>(nodes)
      .force('link', forceLink<SimN, SimL>(links).id(d => d.id).distance(50).strength(0.3))
      .force('charge', forceManyBody<SimN>().strength(-120))
      .force('x', forceX<SimN>(width / 2).strength(0.05))
      .force('y', forceY<SimN>(height / 2).strength(0.05))
      .force('center', forceCenter(width / 2, height / 2))
      .force('collide', forceCollide<SimN>().radius(d => radius(d) + 3))
      .alpha(1).alphaDecay(0.025)
      .on('tick', () => tick(v => v + 1));
    simRef.current = sim;
    return () => { sim.stop(); };
  }, [nodes, links, width, height]);

  function handleMouseDown(e: React.MouseEvent, node: SimN) {
    e.preventDefault(); e.stopPropagation();
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    node.fx = node.x; node.fy = node.y;
    simRef.current?.alphaTarget(0.3).restart();
    const onMove = (ev: MouseEvent) => {
      pt.x = ev.clientX; pt.y = ev.clientY;
      const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
      node.fx = p.x; node.fy = p.y;
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      simRef.current?.alphaTarget(0);
      if (!node.isMe) { node.fx = null; node.fy = null; }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  const connected = useMemo(() => {
    if (!hoverId) return null;
    const set = new Set<string>([hoverId]);
    for (const l of links) {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      if (s === hoverId) set.add(t);
      if (t === hoverId) set.add(s);
    }
    return set;
  }, [hoverId, links]);

  const hovered = hoverId ? nodes.find(n => n.id === hoverId) : null;

  return (
    <div style={{ position: 'relative', width, height }}>
    <svg ref={svgRef} width={width} height={height} style={{ display: 'block', userSelect: 'none' }}>
      <defs>
        <radialGradient id="coauthor-glow">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g>
        {links.map((l, i) => {
          const s = typeof l.source === 'object' ? l.source as SimN : null;
          const t = typeof l.target === 'object' ? l.target as SimN : null;
          if (!s || !t) return null;
          const dim = connected && !(connected.has(s.id) && connected.has(t.id));
          return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y}
            stroke={dim ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.14)'}
            strokeWidth={Math.min(2.5, 0.5 + l.weight * 0.3)} />;
        })}
      </g>
      <g>
        {nodes.map(n => {
          const r = radius(n);
          const isHov = n.id === hoverId;
          const dim = connected && !connected.has(n.id);
          return (
            <g key={n.id} transform={`translate(${n.x}, ${n.y})`}
              onMouseEnter={() => setHoverId(n.id)} onMouseLeave={() => setHoverId(null)}
              onMouseDown={e => handleMouseDown(e, n)}
              onClick={e => { e.stopPropagation(); e.preventDefault(); window.location.href = `/overview.html?highlight=${encodeURIComponent(n.id)}`; }}
              style={{ cursor: 'pointer', opacity: dim ? 0.25 : 1, transition: 'opacity 0.2s' }}>
              {isHov && <circle r={r + 10} fill="url(#coauthor-glow)" />}
              <circle r={r}
                fill={nodeColor(n)}
                stroke={isHov ? '#fff' : 'rgba(255,255,255,0.2)'}
                strokeWidth={isHov ? 2 : 1} />
              {n.isMe && (
                <text x={0} y={r + 13} textAnchor="middle" fill="rgba(255,255,255,0.85)" fontSize={11} fontFamily="Inter, sans-serif" style={{ pointerEvents: 'none' }}>
                  {n.label}
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
    {hovered && !hovered.isMe && (
      <div style={{ position: 'absolute', left: hovered.x, top: hovered.y - radius(hovered) - 8, transform: 'translate(-50%, -100%)', pointerEvents: 'none', background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: 4, padding: '6px 10px', fontSize: 12, color: 'var(--fg)', whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,0.4)', zIndex: 2 }}>
        <div style={{ fontWeight: 500 }}>{hovered.label}</div>
        {hovered.affiliation && <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>{hovered.affiliation.name}</div>}
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--fg-dim)', marginTop: 2 }}>{hovered.weight} shared {hovered.weight === 1 ? 'paper' : 'papers'}</div>
      </div>
    )}
    </div>
  );
}
