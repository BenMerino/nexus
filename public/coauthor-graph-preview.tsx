import React, { useEffect, useRef, useState } from 'react';
import { SectionHead, Ico } from './ui-primitives';
import { CoAuthorSim } from './coauthor-graph-sim';
import type { CoauthorGraph } from './dashboard-builders.js';

export function CoAuthorGraphPanel({ graph }: { graph?: CoauthorGraph }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const measure = () => { const r = el.getBoundingClientRect(); setSize({ w: r.width, h: Math.max(260, r.height) }); };
    measure();
    const ro = new ResizeObserver(measure); ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const nodes = graph?.nodes ?? [];
  const emptyMsg = !graph ? 'Co-author graph unavailable.'
    : nodes.length === 0 ? 'No papers indexed yet.'
    : nodes.length === 1 ? 'Papers indexed, but no co-authors have ORCIDs attached.'
    : null;

  return (
    <section className="card card-graph-preview" style={{ display: 'flex', flexDirection: 'column' }}>
      <SectionHead eyebrow="Network" title="Your co-author graph"
        right={<a className="link-btn" href="/overview.html">Open explorer {Ico.arrow}</a>} />
      <div ref={ref} style={{ position: 'relative', width: '100%', flex: 1, minHeight: 260 }}>
        {emptyMsg ? <div className="muted">{emptyMsg}</div> : size && <CoAuthorSim graph={graph!} width={size.w} height={size.h} />}
      </div>
    </section>
  );
}
