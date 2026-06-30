import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Ico, Skeleton } from './ui-kit';
import { CoAuthorSim } from './coauthor-graph-sim';
import { CommunityLegend, type CommunityAdapter } from './community-graph';
import type { CoauthorGraph, CoauthorNode } from './dashboard-builders';

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
  const myRor = graph?.nodes.find(n => n.isMe)?.affiliation?.ror || null;

  const legendAdapter = useMemo<CommunityAdapter<CoauthorNode>>(() => ({
    getId: n => n.id,
    getLabel: n => n.label,
    getRadius: () => 0,
    getCommunityKey: n => n.affiliation?.ror ?? null,
    isEgo: n => !!n.isMe,
    getCommunityLabel: (_key, sample) => sample.affiliation?.name || _key,
  }), []);

  const emptyMsg = !graph ? 'Co-author graph unavailable.'
    : nodes.length === 0 ? 'No papers indexed yet.'
    : nodes.length === 1 ? 'Papers indexed, but no co-authors have ORCIDs attached.'
    : null;

  return (
    <section className="card card-graph-preview" style={{ display: 'flex', gap: 18, alignItems: 'stretch' }}>
      <aside style={{ width: 180, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div className="eyebrow">Network</div>
          <h2 className="section-title">Your co-author graph</h2>
        </div>
        <a className="link-btn" href="/overview.html" style={{ alignSelf: 'flex-start' }}>Open explorer {Ico.arrow}</a>
        {!emptyMsg && graph && <CommunityLegend nodes={graph.nodes} adapter={legendAdapter} primaryKey={myRor} />}
      </aside>
      <div ref={ref} style={{ position: 'relative', flex: 1, minHeight: 260 }}>
        {emptyMsg ? <div className="muted">{emptyMsg}</div> : size && <CoAuthorSim graph={graph!} width={size.w} height={size.h} />}
      </div>
    </section>
  );
}

export function CoAuthorGraphPanelSkeleton() {
  const legendNames = ['Universidad de Talca', 'Pontificia U. Católica', 'Universidad de Chile', 'U. Austral de Chile', 'U. de Concepción'];
  return (
    <section className="card card-graph-preview" style={{ display: 'flex', gap: 18, alignItems: 'stretch' }}>
      <aside style={{ width: 180, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div className="eyebrow">Network</div>
          <h2 className="section-title">Your co-author graph</h2>
        </div>
        <a className="link-btn" style={{ alignSelf: 'flex-start' }}>Open explorer →</a>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
          {legendNames.map((name, i) => (
            <span key={i} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--bg-inset)' }} />
              <Skeleton as="span" style={{ fontSize: 'var(--text-micro)' }}>{name}</Skeleton>
            </span>
          ))}
        </div>
      </aside>
      <div style={{ position: 'relative', flex: 1, minHeight: 260 }}>
        <Skeleton fill style={{ opacity: 0.4 }} />
      </div>
    </section>
  );
}
