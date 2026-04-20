import {
  forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY,
  type Simulation,
} from 'd3-force';
import { majorCommunities, effectiveKey, OTHER_KEY } from './communities';
import { forceCommunityContainment } from './containment';
import type { CommunityAdapter, ForceConfig } from './types';

export type SimN<N> = N & { x: number; y: number; fx?: number | null; fy?: number | null };
/** d3-force mutates source/target from string id → resolved node object. */
export interface ResolvedEndpoint { id: string; x: number; y: number }
export type SimL<L> = Omit<L, 'source' | 'target'> & { source: string | ResolvedEndpoint; target: string | ResolvedEndpoint };

export interface BaseLink { source: string; target: string }

export function initialNodes<N>(nodes: N[], adapter: CommunityAdapter<N>, width: number, height: number): SimN<N>[] {
  return nodes.map(n => {
    const ego = adapter.isEgo(n);
    return {
      ...n,
      x: width / 2 + (Math.random() - 0.5) * width * 0.5,
      y: height / 2 + (Math.random() - 0.5) * height * 0.5,
      fx: ego ? width / 2 : null,
      fy: ego ? height / 2 : null,
    };
  });
}

export function initialLinks<N, L extends BaseLink>(edges: L[], nodes: SimN<N>[], adapter: CommunityAdapter<N>): SimL<L>[] {
  const nmap = new Map(nodes.map(n => [adapter.getId(n), n]));
  return edges
    .filter(e => nmap.has(e.source) && nmap.has(e.target))
    .map(e => ({ ...e } as SimL<L>));
}

/** Community anchor points: major communities + one shared "Other" slot arranged around the ego. */
export function buildAnchors<N>(
  nodes: SimN<N>[],
  adapter: CommunityAdapter<N>,
  primaryKey: string | null,
  width: number,
  height: number,
  minSize: number,
  orbitFraction: number,
): Map<string, { x: number; y: number }> {
  const major = majorCommunities(nodes, adapter, primaryKey, minSize);
  const counts = new Map<string, number>();
  for (const key of major) {
    counts.set(key, nodes.filter(n => adapter.getCommunityKey(n) === key).length);
  }
  const hasOther = nodes.some(n => effectiveKey(n, adapter, major) === OTHER_KEY);
  const slots: string[] = [...major]
    .filter(k => k !== primaryKey)
    .sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0));
  if (hasOther) slots.push(OTHER_KEY);

  const map = new Map<string, { x: number; y: number }>();
  const orbit = Math.min(width, height) * orbitFraction;
  slots.forEach((key, i) => {
    const a = (i / Math.max(slots.length, 1)) * Math.PI * 2 - Math.PI / 2;
    map.set(key, {
      x: width / 2 + Math.cos(a) * orbit,
      y: height / 2 + Math.sin(a) * orbit,
    });
  });
  if (primaryKey) map.set(primaryKey, { x: width / 2, y: height / 2 });
  return map;
}

interface SimulationOptions<N, L extends BaseLink> {
  nodes: SimN<N>[];
  links: SimL<L>[];
  anchors: Map<string, { x: number; y: number }>;
  adapter: CommunityAdapter<N>;
  primaryKey: string | null;
  width: number;
  height: number;
  config: ForceConfig;
  onTick: () => void;
}

export function createSimulation<N, L extends BaseLink>({
  nodes, links, anchors, adapter, primaryKey, width, height, config, onTick,
}: SimulationOptions<N, L>): Simulation<SimN<N>, SimL<L>> {
  const major = majorCommunities(nodes, adapter, primaryKey, config.minCommunitySize);
  const anchorFor = (n: SimN<N>) => {
    if (adapter.isEgo(n) && primaryKey) return anchors.get(primaryKey);
    const key = effectiveKey(n, adapter, major);
    return key ? anchors.get(key) : null;
  };

  const chargeFn = typeof config.charge === 'function'
    ? config.charge
    : () => config.charge as number;

  return forceSimulation<SimN<N>, SimL<L>>(nodes)
    .force('link', forceLink<SimN<N>, SimL<L>>(links).id(d => adapter.getId(d)).distance(config.linkDistance).strength(config.linkStrength))
    .force('charge', forceManyBody<SimN<N>>().strength(d => chargeFn((d as unknown as { group?: string }).group)))
    .force('clusterX', forceX<SimN<N>>(d => anchorFor(d)?.x ?? width / 2).strength(config.clusterStrengthX))
    .force('clusterY', forceY<SimN<N>>(d => anchorFor(d)?.y ?? height / 2).strength(config.clusterStrengthY))
    .force('collide', forceCollide<SimN<N>>().radius(d => adapter.getRadius(d) + config.collidePad))
    .force('containment', forceCommunityContainment(adapter, primaryKey, config.minCommunitySize, config.containmentStrength, config.containmentRadiusMultiplier))
    .alpha(1)
    .alphaDecay(0.025)
    .on('tick', () => {
      clampToViewport(nodes, adapter, width, height);
      onTick();
    });
}

function clampToViewport<N>(nodes: SimN<N>[], adapter: CommunityAdapter<N>, width: number, height: number) {
  for (const n of nodes) {
    const r = adapter.getRadius(n);
    n.x = Math.max(r + 2, Math.min(width - r - 2, n.x));
    n.y = Math.max(r + 2, Math.min(height - r - 2, n.y));
  }
}
