import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceX, forceY,
  type Simulation,
} from 'd3-force';
import type { EnrichedSimNode, ProjectedEdge } from './relationship-types';
import { COLORS, nodeRadius } from './relationship-types';
import { SmoothedHulls, type HullGroup } from './smoothed-hulls';
import { buildExplorerHullGroups, type GroupByDim } from './explorer-hull-groups';
import { ForceGraphNodes } from './force-graph-nodes';

interface Props {
  nodes: EnrichedSimNode[];
  links: ProjectedEdge[];
  width: number;
  height: number;
  selectedId?: string | null;
  onNodeClick?: (n: EnrichedSimNode) => void;
  accent?: string;
  groupBy?: GroupByDim;
  yearByNodeId?: Map<string, string>;
}

type SimN = EnrichedSimNode & { x: number; y: number; fx?: number | null; fy?: number | null };
type SimL = ProjectedEdge & { source: SimN | string; target: SimN | string };

export function ForceGraph({ nodes: inNodes, links: inLinks, width, height, selectedId, onNodeClick, accent = 'var(--accent)', groupBy = 'none', yearByNodeId }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const simRef = useRef<Simulation<SimN, SimL> | null>(null);
  const [, tick] = useState(0);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const dragRef = useRef<SimN | null>(null);

  const { nodes, links } = useMemo(() => {
    const ns: SimN[] = inNodes.map(n => ({
      ...n,
      x: width / 2 + (Math.random() - 0.5) * Math.min(width, height) * 0.6,
      y: height / 2 + (Math.random() - 0.5) * Math.min(width, height) * 0.6,
    }));
    const nmap = new Map(ns.map(n => [n.id, n]));
    const ls: SimL[] = inLinks
      .filter(l => nmap.has(l.source as string) && nmap.has(l.target as string))
      .map(l => ({ ...l }));
    return { nodes: ns, links: ls };
  }, [inNodes, inLinks, width, height]);

  useEffect(() => {
    const sim = forceSimulation<SimN, SimL>(nodes)
      .force('link', forceLink<SimN, SimL>(links).id(d => d.id).distance(d => 60 + (d.weight ? 0 : 10)).strength(0.4))
      .force('charge', forceManyBody<SimN>().strength(d => d.group === 'doi' ? -60 : -220))
      .force('x', forceX<SimN>(width / 2).strength(0.05))
      .force('y', forceY<SimN>(height / 2).strength(0.05))
      .force('center', forceCenter(width / 2, height / 2))
      .force('collide', forceCollide<SimN>().radius(d => radius(d) + 4))
      .alpha(1)
      .alphaDecay(0.025)
      .on('tick', () => tick(v => v + 1));
    simRef.current = sim;
    return () => { sim.stop(); };
  }, [nodes, links, width, height]);

  function radius(n: EnrichedSimNode): number {
    return nodeRadius(n.weight || 1, n.role);
  }
  function color(n: EnrichedSimNode): string {
    return COLORS[n.group] || accent;
  }

  function handleMouseDown(e: React.MouseEvent, node: SimN) {
    e.preventDefault();
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    dragRef.current = node;
    node.fx = node.x; node.fy = node.y;
    simRef.current?.alphaTarget(0.3).restart();
    function onMove(ev: MouseEvent) {
      pt.x = ev.clientX; pt.y = ev.clientY;
      const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
      node.fx = p.x; node.fy = p.y;
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      simRef.current?.alphaTarget(0);
      node.fx = null; node.fy = null;
      dragRef.current = null;
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  const connected = useMemo(() => {
    const focusId = hoverId || selectedId;
    if (!focusId) return null;
    const set = new Set<string>([focusId]);
    for (const l of links) {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      if (s === focusId) set.add(t);
      if (t === focusId) set.add(s);
    }
    return set;
  }, [hoverId, selectedId, links]);

  const hullGroups: HullGroup[] = groupBy === 'none'
    ? []
    : buildExplorerHullGroups(groupBy, nodes, links as unknown as ProjectedEdge[], yearByNodeId || new Map())
        .map(g => ({ key: g.key, color: g.color, points: g.points }));

  return (
    <svg ref={svgRef} width={width} height={height} style={{ display: 'block', userSelect: 'none' }}>
      <defs>
        <radialGradient id="nodeGlow">
          <stop offset="0%" stopColor={accent} stopOpacity="0.5" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      <SmoothedHulls groups={hullGroups} />
      <g>
        {links.map((l, i) => {
          const s = typeof l.source === 'object' ? l.source as SimN : null;
          const t = typeof l.target === 'object' ? l.target as SimN : null;
          if (!s || !t) return null;
          const dim = connected && !(connected.has(s.id) && connected.has(t.id));
          return (
            <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y}
              stroke={dim ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.14)'}
              strokeWidth={l.weight ? Math.min(2.5, 0.5 + l.weight * 0.4) : 0.7} />
          );
        })}
      </g>
      <ForceGraphNodes
        nodes={nodes}
        radius={radius}
        color={color}
        hoverId={hoverId}
        selectedId={selectedId}
        connected={connected}
        onHoverStart={setHoverId}
        onHoverEnd={() => setHoverId(null)}
        onMouseDown={handleMouseDown}
        onClick={n => onNodeClick?.(n)}
      />
    </svg>
  );
}
