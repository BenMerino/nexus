import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SectionHead, Ico } from './ui-primitives';
import { CoAuthorSim } from './coauthor-graph-sim';
import { buildCommunityColors, majorRors, communityKeyFor, OTHER_KEY, OTHER_LABEL } from './coauthor-communities';
import type { CoauthorGraph } from './dashboard-builders.js';

function Legend({ graph }: { graph: CoauthorGraph }) {
  const myRor = graph.nodes.find(n => n.isMe)?.affiliation?.ror || null;
  const colors = useMemo(() => buildCommunityColors(graph.nodes, myRor), [graph, myRor]);
  const major = useMemo(() => majorRors(graph.nodes, myRor), [graph, myRor]);
  const items = useMemo(() => {
    const byKey = new Map<string, { name: string; count: number }>();
    for (const n of graph.nodes) {
      const key = communityKeyFor(n, myRor, major);
      if (!key) continue;
      const name = key === OTHER_KEY ? OTHER_LABEL : (n.affiliation?.name || key);
      const e = byKey.get(key) || { name, count: 0 };
      e.count += 1; byKey.set(key, e);
    }
    const list = [...byKey.entries()];
    return list.sort((a, b) => {
      if (a[0] === OTHER_KEY) return 1;
      if (b[0] === OTHER_KEY) return -1;
      return b[1].count - a[1].count;
    });
  }, [graph, myRor, major]);
  const home = graph.nodes.find(n => n.isMe)?.affiliation?.name;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginTop: 10, fontSize: 11, color: 'var(--fg-muted)' }}>
      {home && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} /> {home}</span>}
      {items.map(([key, info]) => (
        <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: colors.get(key) }} /> {info.name} <span style={{ color: 'var(--fg-dim)', fontFamily: 'var(--mono)' }}>·{info.count}</span>
        </span>
      ))}
    </div>
  );
}

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
      {!emptyMsg && graph && <Legend graph={graph} />}
    </section>
  );
}
