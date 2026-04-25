import { useEffect, useMemo, useRef } from 'react';
import type { Simulation } from 'd3-force';
import {
  initialNodes, initialLinks, buildAnchors, createSimulation,
  type SimN, type SimL, type BaseLink,
} from './forces';
import type { CommunityAdapter, ForceConfig } from './types';

interface Args<N, L extends BaseLink> {
  inNodes: N[];
  inLinks: L[];
  adapter: CommunityAdapter<N>;
  primaryKey: string | null;
  width: number;
  height: number;
  config: ForceConfig;
  onTick: () => void;
}

interface Result<N, L extends BaseLink> {
  nodes: SimN<N>[];
  links: SimL<L>[];
  simRef: React.MutableRefObject<Simulation<SimN<N>, SimL<L>> | null>;
}

export function useCommunitySim<N, L extends BaseLink & { weight?: number }>({
  inNodes, inLinks, adapter, primaryKey, width, height, config, onTick,
}: Args<N, L>): Result<N, L> {
  const simRef = useRef<Simulation<SimN<N>, SimL<L>> | null>(null);

  const { nodes, links } = useMemo(() => {
    const ns = initialNodes(inNodes, adapter, width, height);
    const ls = initialLinks(inLinks, ns, adapter);
    return { nodes: ns, links: ls };
    // Intentionally omit `adapter` from deps: only isEgo/getId are read here,
    // and those are stable for a given node set. Re-running on every adapter
    // identity change would reseed positions and cause visible jumps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inNodes, inLinks, width, height]);

  const anchors = useMemo(
    () => buildAnchors(nodes, adapter, primaryKey, width, height, config.minCommunitySize, config.orbitRadius),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes, primaryKey, width, height, config.minCommunitySize, config.orbitRadius],
  );

  useEffect(() => {
    const sim = createSimulation({
      nodes, links, anchors, adapter, primaryKey, width, height, config, onTick,
    });
    simRef.current = sim;
    return () => { sim.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, links, anchors, primaryKey, width, height]);

  return { nodes, links, simRef };
}
