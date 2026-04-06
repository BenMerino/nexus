import { useState, useEffect, useCallback, useRef } from 'react';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceX, forceY } from 'd3-force';
import type { EnrichedTagNode, EnrichedSimNode, Category } from './relationship-types';
import type { ProjectedEdge } from './relationship-types';
import { nodeRadius } from './relationship-types';

function buildCategoryXTargets(catOrder: Category[], width: number): Map<string, number> {
  const map = new Map<string, number>();
  if (catOrder.length <= 1) return map;
  const margin = 100;
  const usable = width - margin * 2;
  catOrder.forEach((cat, i) => {
    map.set(cat, margin + (i / (catOrder.length - 1)) * usable);
  });
  return map;
}

export function useForceLayout(
  inputNodes: EnrichedTagNode[], edges: ProjectedEdge[], width: number, height: number,
  categoryOrder?: Category[],
) {
  const simRef = useRef<any>(null);
  const nodesRef = useRef<EnrichedSimNode[]>([]);
  const [snapshot, setSnapshot] = useState<EnrichedSimNode[]>([]);
  const inputKeyRef = useRef('');

  const inputKey = inputNodes.map(n => n.id).join(',');
  const catKey = categoryOrder?.join(',') || '';

  useEffect(() => {
    const catTargets = buildCategoryXTargets(categoryOrder || [], width);
    const xTarget = (n: EnrichedSimNode) => catTargets.get(n.group) ?? width / 2;
    const xStrength = (n: EnrichedSimNode) => catTargets.has(n.group) ? 0.12 : 0.01;

    if (inputKey === inputKeyRef.current && simRef.current) {
      // Only category order changed — update x force and reheat
      simRef.current.force('x', forceX<EnrichedSimNode>(xTarget).strength(xStrength));
      simRef.current.alpha(0.3).restart();
      return;
    }
    inputKeyRef.current = inputKey;
    if (simRef.current) simRef.current.stop();

    const nodes: EnrichedSimNode[] = inputNodes.map(n => ({
      ...n,
      x: catTargets.get(n.group) ?? width / 2 + (Math.random() - 0.5) * width * 0.5,
      y: height / 2 + (Math.random() - 0.5) * height * 0.5,
      vx: 0, vy: 0, fx: null, fy: null,
    }));
    nodesRef.current = nodes;

    const nodeIndex = new Map(nodes.map((n, i) => [n.id, i]));
    const links = edges
      .filter(e => nodeIndex.has(e.source) && nodeIndex.has(e.target))
      .map(e => ({ source: nodeIndex.get(e.source)!, target: nodeIndex.get(e.target)!, weight: e.weight }));

    const sim = forceSimulation(nodes as any)
      .force('charge', forceManyBody().strength(-600).distanceMax(500))
      .force('link', forceLink(links).distance(140).strength((l: any) => 0.15 + 0.05 * Math.min(l.weight, 5)))
      .force('center', forceCenter(width / 2, height / 2).strength(0.02))
      .force('collide', forceCollide<EnrichedSimNode>()
        .radius(n => nodeRadius(n.weight || 0) + 35).strength(1).iterations(3))
      .force('x', forceX<EnrichedSimNode>(xTarget).strength(xStrength))
      .force('y', forceY(height / 2).strength(0.01))
      .alphaDecay(0.015)
      .velocityDecay(0.4)
      .on('tick', () => {
        for (const n of nodes) {
          n.x = Math.max(60, Math.min(width - 60, n.x));
          n.y = Math.max(30, Math.min(height - 30, n.y));
        }
        setSnapshot(nodes.map(n => ({ ...n })));
      });

    simRef.current = sim;
    return () => { sim.stop(); };
  }, [inputKey, catKey, edges, width, height]);

  const reheat = useCallback(() => {
    if (simRef.current) simRef.current.alpha(0.3).restart();
  }, []);

  return { simNodes: snapshot, nodesRef, simRef, reheat };
}
