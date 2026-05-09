import { useEffect, useRef } from 'react';
import { integrateZ } from './forces';
import type { SimN } from './forces';
import type { CommunityAdapter } from './types';

const EPS = 0.05;

/** Drive Z-axis integration off rAF using the latest adapter, independent of
 *  d3-force's 2D sim. d3 captures the adapter by closure when the sim is
 *  created — a layer-order change wouldn't take effect without this hook.
 *
 *  The loop parks itself once every node is near its target Z (|z - target|
 *  < EPS and |vz| < EPS), and reheats whenever the adapter or layer strength
 *  changes so new targets get pulled toward. */
export function useLayerIntegration<N>(
  nodes: SimN<N>[],
  adapter: CommunityAdapter<N>,
  strength: number,
  onTick: () => void,
) {
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;

  useEffect(() => {
    if (!adapter.getLayerZ) return;
    let raf = 0;
    const step = () => {
      integrateZ(nodes, adapterRef.current, strength);
      onTick();
      const settled = nodes.every(n => {
        const target = adapterRef.current.getLayerZ!(n);
        return Math.abs(n.z - target) < EPS && Math.abs(n.vz) < EPS;
      });
      if (settled) return;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [nodes, adapter, strength, onTick]);
}
