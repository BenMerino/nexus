import { useState, useEffect, useCallback, useRef } from 'react';
import { forceSimulation, forceLink, forceCollide, forceX, forceY } from 'd3-force';
import type { EnrichedTagNode, EnrichedSimNode } from './relationship-types';
import type { ProjectedEdge } from './relationship-types';
import { nodeRadius } from './relationship-types';

export function useForceLayout(
  inputNodes: EnrichedTagNode[], edges: ProjectedEdge[], width: number, height: number,
) {
  const simRef = useRef<any>(null);
  const nodesRef = useRef<EnrichedSimNode[]>([]);
  const [snapshot, setSnapshot] = useState<EnrichedSimNode[]>([]);
  const inputKeyRef = useRef('');
  const rafRef = useRef(0);
  const dirtyRef = useRef(false);
  const pinTimer = useRef<any>(null);
  const inputKey = inputNodes.map(n => n.id).join(',');

  useEffect(() => {
    if (inputKey === inputKeyRef.current && simRef.current) return;
    inputKeyRef.current = inputKey;
    if (simRef.current) simRef.current.stop();
    cancelAnimationFrame(rafRef.current);
    if (pinTimer.current) clearTimeout(pinTimer.current);

    // Remember where existing nodes are so they can animate from old → new position
    const prevPos = new Map<string, { x: number; y: number }>();
    for (const n of nodesRef.current) prevPos.set(n.id, { x: n.x, y: n.y });

    const journals = inputNodes.filter(n => n.group === 'journal');
    const jCount = journals.length;
    const pos = new Map<string, { x: number; y: number }>();

    // Aligned grid: journals in straight rows and columns
    const cols = Math.min(jCount, 4);
    const padX = 140;
    const colW = (width - padX * 2) / Math.max(cols - 1, 1);
    const rowH = 90;
    const gridTop = 130;

    journals.sort((a, b) => (b.weight || 0) - (a.weight || 0));
    journals.forEach((j, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      pos.set(j.id, {
        x: cols === 1 ? width / 2 : padX + col * colW,
        y: gridTop + row * rowH,
      });
    });

    // Header nodes — spaced apart so cards don't overlap
    const inst = inputNodes.find(n => n.group === 'institution');
    const auth = inputNodes.find(n => n.group === 'author');
    if (inst) pos.set(inst.id, { x: width / 2, y: 25 });
    if (auth) pos.set(auth.id, { x: width / 2, y: 75 });



    const alwaysPin = new Set(['institution', 'author']);
    const nodes: EnrichedSimNode[] = inputNodes.map(n => {
      const target = pos.get(n.id) || { x: width / 2, y: height / 2 };
      const prev = prevPos.get(n.id);
      if (alwaysPin.has(n.group)) {
        return { ...n, x: target.x, y: target.y, vx: 0, vy: 0, fx: target.x, fy: target.y };
      }
      // Journals start at old position and animate to new grid slot; new nodes start at target
      const start = prev && n.group === 'journal' ? prev : target;
      return { ...n, x: start.x, y: start.y, vx: 0, vy: 0, fx: null, fy: null };
    });
    nodesRef.current = nodes;

    const nodeIndex = new Map(nodes.map((n, i) => [n.id, i]));
    const links = edges
      .filter(e => nodeIndex.has(e.source) && nodeIndex.has(e.target))
      .map(e => ({ source: nodeIndex.get(e.source)!, target: nodeIndex.get(e.target)! }));

    const flush = () => {
      if (dirtyRef.current) {
        dirtyRef.current = false;
        setSnapshot(nodes.map(n => ({ ...n })));
      }
      rafRef.current = requestAnimationFrame(flush);
    };
    rafRef.current = requestAnimationFrame(flush);

    const sim = forceSimulation(nodes as any)
      .force('link', forceLink(links).distance(50).strength(0.03))
      .force('x', forceX<EnrichedSimNode>((n: EnrichedSimNode) => pos.get(n.id)?.x ?? width / 2)
        .strength((n: EnrichedSimNode) => n.group === 'doi' ? 0.4 : 0.9))
      .force('y', forceY<EnrichedSimNode>((n: EnrichedSimNode) => pos.get(n.id)?.y ?? height / 2)
        .strength((n: EnrichedSimNode) => n.group === 'doi' ? 0.4 : 0.9))
      .force('collide', forceCollide<EnrichedSimNode>()
        .radius(n => nodeRadius(n.weight || 0) + 12).strength(0.5).iterations(2))
      .alphaDecay(0.08)
      .velocityDecay(0.6)
      .on('tick', () => { dirtyRef.current = true; });

    simRef.current = sim;

    // Pin nodes after they've animated to their grid positions
    pinTimer.current = setTimeout(() => {
      for (const n of nodes) {
        if (!pinGroups.has(n.group)) continue;
        const p = pos.get(n.id);
        if (p) { n.fx = p.x; n.fy = p.y; n.x = p.x; n.y = p.y; }
      }
      dirtyRef.current = true;
    }, 600);

    return () => { sim.stop(); cancelAnimationFrame(rafRef.current); clearTimeout(pinTimer.current); };
  }, [inputKey, edges, width, height]);

  const reheat = useCallback(() => {
    if (simRef.current) simRef.current.alpha(0.3).restart();
  }, []);

  return { simNodes: snapshot, nodesRef, simRef, reheat };
}
