import { useState, useEffect, useCallback, useRef } from 'react';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceX, forceY } from 'd3-force';
import type { EnrichedTagNode, EnrichedSimNode } from './relationship-types';
import type { ProjectedEdge } from './relationship-types';
import { nodeRadius } from './relationship-types';

/** Build community-based spatial targets arranged in a circle */
function buildCommunityTargets(
  nodes: EnrichedTagNode[], width: number, height: number,
): Map<number, { x: number; y: number }> {
  const communities = [...new Set(nodes.map(n => n.community))].sort((a, b) => a - b);
  const map = new Map<number, { x: number; y: number }>();
  if (communities.length <= 1) return map;
  const cx = width / 2;
  const cy = height / 2;
  const rx = (width - 200) / 2 * 0.6;
  const ry = (height - 100) / 2 * 0.6;
  communities.forEach((comm, i) => {
    const angle = (2 * Math.PI * i) / communities.length - Math.PI / 2;
    map.set(comm, { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) });
  });
  return map;
}

function physicsParams(n: number) {
  const large = n > 80;
  return {
    chargeStrength: large ? -300 : -600,
    chargeMax: large ? 300 : 500,
    collideIterations: large ? 1 : 3,
    collidePad: large ? 15 : 35,
    alphaDecay: large ? 0.04 : 0.015,
    velocityDecay: large ? 0.5 : 0.4,
  };
}

export function useForceLayout(
  inputNodes: EnrichedTagNode[], edges: ProjectedEdge[], width: number, height: number,
) {
  const simRef = useRef<any>(null);
  const nodesRef = useRef<EnrichedSimNode[]>([]);
  const [snapshot, setSnapshot] = useState<EnrichedSimNode[]>([]);
  const inputKeyRef = useRef('');
  const rafRef = useRef(0);
  const dirtyRef = useRef(false);

  const inputKey = inputNodes.map(n => n.id).join(',');
  const commKey = inputNodes.map(n => n.community).join(',');

  useEffect(() => {
    const commTargets = buildCommunityTargets(inputNodes, width, height);
    const xTarget = (n: EnrichedSimNode) => commTargets.get(n.community)?.x ?? width / 2;
    const yTarget = (n: EnrichedSimNode) => commTargets.get(n.community)?.y ?? height / 2;
    const xyStrength = (n: EnrichedSimNode) => commTargets.has(n.community) ? 0.12 : 0.01;

    if (inputKey === inputKeyRef.current && simRef.current) {
      simRef.current
        .force('x', forceX<EnrichedSimNode>(xTarget).strength(xyStrength))
        .force('y', forceY<EnrichedSimNode>(yTarget).strength(xyStrength));
      simRef.current.alpha(0.3).restart();
      return;
    }
    inputKeyRef.current = inputKey;
    if (simRef.current) simRef.current.stop();
    cancelAnimationFrame(rafRef.current);

    const nodes: EnrichedSimNode[] = inputNodes.map(n => ({
      ...n,
      x: commTargets.get(n.community)?.x ?? width / 2 + (Math.random() - 0.5) * width * 0.5,
      y: commTargets.get(n.community)?.y ?? height / 2 + (Math.random() - 0.5) * height * 0.5,
      vx: 0, vy: 0, fx: null, fy: null,
    }));
    nodesRef.current = nodes;

    const nodeIndex = new Map(nodes.map((n, i) => [n.id, i]));
    const links = edges
      .filter(e => nodeIndex.has(e.source) && nodeIndex.has(e.target))
      .map(e => ({ source: nodeIndex.get(e.source)!, target: nodeIndex.get(e.target)!, weight: e.weight }));

    const pp = physicsParams(nodes.length);

    // Throttled rendering via rAF — only flush snapshots at display refresh rate
    const flush = () => {
      if (dirtyRef.current) {
        dirtyRef.current = false;
        setSnapshot(nodes.map(n => ({ ...n })));
      }
      rafRef.current = requestAnimationFrame(flush);
    };
    rafRef.current = requestAnimationFrame(flush);

    const sim = forceSimulation(nodes as any)
      .force('charge', forceManyBody().strength(pp.chargeStrength).distanceMax(pp.chargeMax))
      .force('link', forceLink(links).distance(140).strength((l: any) => 0.15 + 0.05 * Math.min(l.weight, 5)))
      .force('center', forceCenter(width / 2, height / 2).strength(0.02))
      .force('collide', forceCollide<EnrichedSimNode>()
        .radius(n => nodeRadius(n.weight || 0) + pp.collidePad).strength(1).iterations(pp.collideIterations))
      .force('x', forceX<EnrichedSimNode>(xTarget).strength(xyStrength))
      .force('y', forceY<EnrichedSimNode>(yTarget).strength(xyStrength))
      .alphaDecay(pp.alphaDecay)
      .velocityDecay(pp.velocityDecay)
      .on('tick', () => {
        for (const n of nodes) {
          n.x = Math.max(60, Math.min(width - 60, n.x));
          n.y = Math.max(30, Math.min(height - 30, n.y));
        }
        dirtyRef.current = true;
      });

    simRef.current = sim;
    return () => { sim.stop(); cancelAnimationFrame(rafRef.current); };
  }, [inputKey, commKey, edges, width, height]);

  const reheat = useCallback(() => {
    if (simRef.current) simRef.current.alpha(0.3).restart();
  }, []);

  return { simNodes: snapshot, nodesRef, simRef, reheat };
}
