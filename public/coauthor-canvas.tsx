import React, { useEffect, useRef, useState } from 'react';
import { CoAuthorSim } from './coauthor-graph-sim';
import type { CoauthorGraph, CoauthorNode } from './dashboard-builders';

interface Props {
  graph: CoauthorGraph;
  minHeight?: number;
  onNodeClick?: (n: CoauthorNode) => void;
}

/** Self-measuring wrapper around <CoAuthorSim>, same pattern as the
 *  dashboard's CoAuthorGraphPanel. Handles late layout and container
 *  resizes so the sim always gets a non-zero width/height. */
export function CoauthorCanvas({ graph, minHeight = 480, onNodeClick }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0) setSize({ w: r.width, h: Math.max(minHeight, r.height) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [minHeight]);

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', height: '100%', minHeight }}>
      {size && <CoAuthorSim graph={graph} width={size.w} height={size.h} onNodeClick={onNodeClick} />}
    </div>
  );
}
