import React, { useEffect, useRef, useState } from 'react';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, type Simulation } from 'd3-force';
import { SectionHead, Ico } from './ui-primitives';
import type { CoauthorGraph, CoauthorNode, CoauthorEdge } from './dashboard-builders.js';

type SimN = CoauthorNode & { x: number; y: number; fx?: number | null; fy?: number | null };
type SimL = CoauthorEdge & { source: SimN | string; target: SimN | string };

function radius(n: CoauthorNode) { return n.isMe ? 9 : 4 + Math.min(5, Math.sqrt(n.weight)); }

function Sim({ graph, width, height }: { graph: CoauthorGraph; width: number; height: number }) {
  const simRef = useRef<Simulation<SimN, SimL> | null>(null);
  const [, tick] = useState(0);
  const [nodes, setNodes] = useState<SimN[]>([]);
  const [links, setLinks] = useState<SimL[]>([]);

  useEffect(() => {
    const ns: SimN[] = graph.nodes.map(n => ({
      ...n,
      x: width / 2 + (Math.random() - 0.5) * width * 0.5,
      y: height / 2 + (Math.random() - 0.5) * height * 0.5,
      fx: n.isMe ? width / 2 : null,
      fy: n.isMe ? height / 2 : null,
    }));
    const nmap = new Map(ns.map(n => [n.id, n]));
    const ls: SimL[] = graph.edges
      .filter(e => nmap.has(e.source) && nmap.has(e.target))
      .map(e => ({ ...e }));
    const sim = forceSimulation<SimN, SimL>(ns)
      .force('link', forceLink<SimN, SimL>(ls).id(d => d.id).distance(40).strength(0.3))
      .force('charge', forceManyBody<SimN>().strength(-80))
      .force('center', forceCenter(width / 2, height / 2))
      .force('collide', forceCollide<SimN>().radius(d => radius(d) + 2))
      .alpha(1).alphaDecay(0.03)
      .on('tick', () => tick(v => v + 1));
    simRef.current = sim;
    setNodes(ns); setLinks(ls);
    return () => { sim.stop(); };
  }, [graph, width, height]);

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <g>
        {links.map((l, i) => {
          const s = typeof l.source === 'object' ? l.source as SimN : null;
          const t = typeof l.target === 'object' ? l.target as SimN : null;
          if (!s || !t) return null;
          return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="rgba(255,255,255,0.12)" strokeWidth={Math.min(2, 0.5 + l.weight * 0.3)} />;
        })}
      </g>
      <g>
        {nodes.map(n => (
          <circle key={n.id} cx={n.x} cy={n.y} r={radius(n)}
            fill={n.isMe ? 'var(--accent)' : 'var(--fg-muted)'}
            stroke={n.isMe ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)'}
            strokeWidth={n.isMe ? 1.5 : 1} />
        ))}
      </g>
    </svg>
  );
}

export function CoAuthorGraphPanel({ graph }: { graph?: CoauthorGraph }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const measure = () => { const r = el.getBoundingClientRect(); setSize({ w: r.width, h: Math.max(200, r.height) }); };
    measure();
    const ro = new ResizeObserver(measure); ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const empty = !graph || graph.nodes.length <= 1;
  return (
    <a href="/overview.html" className="card card-graph-preview" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
      <SectionHead eyebrow="Network" title="Your co-author graph" right={<span className="link-btn">Open explorer {Ico.arrow}</span>} />
      <div ref={ref} style={{ position: 'relative', width: '100%', height: 240 }}>
        {empty ? <div className="muted">No co-authors detected yet.</div> : size && <Sim graph={graph!} width={size.w} height={size.h} />}
      </div>
    </a>
  );
}
