import {
  forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY,
  type Simulation,
} from 'd3-force';
import type { CoauthorNode, CoauthorEdge } from './dashboard-builders.js';
import { radius } from './coauthor-graph-render';
import { majorRors, communityKeyFor, OTHER_KEY } from './coauthor-communities';

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

/** Community anchor points: major communities + one shared "Other" slot arranged around the ego. */
export function buildAnchors(nodes: SimN[], myRor: string | null, width: number, height: number) {
  const major = majorRors(nodes, myRor);
  const counts = new Map<string, number>();
  for (const ror of major) {
    counts.set(ror, nodes.filter(n => n.affiliation?.ror === ror).length);
  }
  const hasOther = nodes.some(n => communityKeyFor(n, myRor, major) === OTHER_KEY);
  const slots: string[] = [...major]
    .filter(ror => ror !== myRor)
    .sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0));
  if (hasOther) slots.push(OTHER_KEY);

  const map = new Map<string, { x: number; y: number }>();
  const orbit = Math.min(width, height) * 0.38;
  slots.forEach((key, i) => {
    const a = (i / Math.max(slots.length, 1)) * Math.PI * 2 - Math.PI / 2;
    map.set(key, {
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
  myRor: string | null;
  width: number;
  height: number;
  onTick: () => void;
}

export function createSimulation({ nodes, links, anchors, myRor, width, height, onTick }: SimulationOptions): Simulation<SimN, SimL> {
  const major = majorRors(nodes, myRor);
  const anchorFor = (n: SimN) => {
    if (n.isMe && myRor) return anchors.get(myRor);
    const key = communityKeyFor(n, myRor, major);
    return key ? anchors.get(key) : null;
  };

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
