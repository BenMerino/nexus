import React, { useEffect, useRef, useState } from 'react';
import { CoAuthorSim } from './coauthor-graph-sim';
import { CommunityLegend, type CommunityAdapter } from './community-graph';
import type { CoauthorGraph, CoauthorNode } from './dashboard-builders.js';
import { Tag } from './ui-primitives';
import { useCurrentUser } from './shell-helpers';

interface Payload { portfolio?: { coauthorGraph?: CoauthorGraph } }

export function CoauthorExplorerBody() {
  const { me } = useCurrentUser();
  const [graph, setGraph] = useState<CoauthorGraph | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 900, h: 600 });

  useEffect(() => {
    fetch('/api/dashboard?action=stats')
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then((d: Payload) => setGraph(d.portfolio?.coauthorGraph ?? null))
      .catch(e => setErr(String(e)));
  }, []);

  useEffect(() => {
    const el = canvasRef.current; if (!el) return;
    const measure = () => { const r = el.getBoundingClientRect(); setDims({ w: r.width, h: Math.max(480, r.height) }); };
    measure();
    const ro = new ResizeObserver(measure); ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const myRor = graph?.nodes.find(n => n.isMe)?.affiliation?.ror || null;

  const legendAdapter: CommunityAdapter<CoauthorNode> = {
    getId: n => n.id,
    getLabel: n => n.label,
    getRadius: () => 0,
    getCommunityKey: n => n.affiliation?.ror ?? null,
    isEgo: n => !!n.isMe,
    getCommunityLabel: (_key, sample) => sample.affiliation?.name || _key,
  };

  const empty = err ? `Error: ${err}`
    : !graph ? null
    : graph.nodes.length === 0 ? 'No papers indexed yet.'
    : graph.nodes.length === 1 ? 'Papers indexed, but no co-authors have ORCIDs attached.'
    : null;

  return (
    <div className="view graph-view">
      <header className="view-head compact">
        <div>
          <div className="eyebrow">Graph explorer</div>
          <h1 className="view-title tight">Your co-author <em>network</em>.</h1>
        </div>
        <div className="view-meta">
          <Tag mono>{graph?.nodes.length ?? 0} NODES</Tag>
          <Tag mono tone="muted">{graph?.edges.length ?? 0} EDGES</Tag>
        </div>
      </header>

      <div className="graph-layout">
        <aside className="graph-filters">
          <div className="filter-group">
            <div className="filter-label">Signed in</div>
            <div className="muted" style={{ fontSize: 12 }}>{me?.user || '—'}</div>
            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>tenant · <em>{me?.tenant || '—'}</em></div>
          </div>
          {graph && graph.nodes.length > 1 && (
            <div className="filter-group legend">
              <div className="filter-label">Communities</div>
              <CommunityLegend nodes={graph.nodes} adapter={legendAdapter} primaryKey={myRor} />
            </div>
          )}
          <div className="filter-hint mono">DRAG nodes · HOVER to isolate</div>
        </aside>

        <div ref={canvasRef} className="graph-canvas" style={{ minHeight: 480 }}>
          {empty ? <div className="muted" style={{ padding: 40, textAlign: 'center' }}>{empty}</div>
            : graph ? <CoAuthorSim graph={graph} width={dims.w} height={dims.h} />
            : <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Loading…</div>}
        </div>
      </div>
    </div>
  );
}
