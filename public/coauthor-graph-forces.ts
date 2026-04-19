import {
  forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY,
  type Simulation,
} from 'd3-force';
import type { CoauthorNode, CoauthorEdge } from './dashboard-builders.js';
import { radius } from './coauthor-graph-render';

export type SimN = CoauthorNode & { x: number; y: number; fx?: number | null; fy?: number | null };
export type SimL = CoauthorEdge & { source: SimN | string; target: SimN | string };

export function initialNodes(nodes: CoauthorNode[], width: number, height: number): SimN[] {
  return nodes.map(n => ({
    ...n,
    x: width / 2 + (Math.random() - 0.5) * width * 0.5,
    y: height / 2 + (Math.random() - 0.5) * height * 0.5,
    fx: n.isMe ? width / 2 : null,
    fy: n.isMe ? height / 2 : null,
  }));
}

export function initialLinks(edges: CoauthorEdge[], nodes: SimN[]): SimL[] {
  const nmap = new Map(nodes.map(n => [n.id, n]));
  return edges
    .filter(e => nmap.has(e.source) && nmap.has(e.target))
    .map(e => ({ ...e }));
}

/** Community anchor points: one per external university arranged around the ego. */
export function buildAnchors(nodes: SimN[], myRor: string | null, width: number, height: number) {
  const externalRors = [...new Set(
    nodes
      .filter(n => !n.isMe && n.affiliation?.ror && n.affiliation.ror !== myRor)
      .map(n => n.affiliation!.ror)
  )];
  const map = new Map<string, { x: number; y: number }>();
  const orbit = Math.min(width, height) * 0.32;
  externalRors.forEach((ror, i) => {
    const a = (i / Math.max(externalRors.length, 1)) * Math.PI * 2 - Math.PI / 2;
    map.set(ror, {
      x: width / 2 + Math.cos(a) * orbit,
      y: height / 2 + Math.sin(a) * orbit,
    });
  });
  if (myRor) map.set(myRor, { x: width / 2, y: height / 2 });
  return map;
}

interface SimulationOptions {
  nodes: SimN[];
  links: SimL[];
  anchors: Map<string, { x: number; y: number }>;
  width: number;
  height: number;
  onTick: () => void;
}

export function createSimulation({ nodes, links, anchors, width, height, onTick }: SimulationOptions): Simulation<SimN, SimL> {
  const anchorFor = (n: SimN) => (n.affiliation?.ror ? anchors.get(n.affiliation.ror) : null);

  return forceSimulation<SimN, SimL>(nodes)
    .force('link', forceLink<SimN, SimL>(links).id(d => d.id).distance(25).strength(0.1))
    .force('charge', forceManyBody<SimN>().strength(-40))
    .force('clusterX', forceX<SimN>(d => anchorFor(d)?.x ?? width / 2).strength(0.4))
    .force('clusterY', forceY<SimN>(d => anchorFor(d)?.y ?? height / 2).strength(0.45))
    .force('collide', forceCollide<SimN>().radius(d => radius(d) + 3))
    .alpha(1)
    .alphaDecay(0.025)
    .on('tick', () => {
      clampToViewport(nodes, width, height);
      onTick();
    });
}

function clampToViewport(nodes: SimN[], width: number, height: number) {
  for (const n of nodes) {
    const r = radius(n);
    n.x = Math.max(r + 2, Math.min(width - r - 2, n.x));
    n.y = Math.max(r + 2, Math.min(height - r - 2, n.y));
  }
}
