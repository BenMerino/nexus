import React, { useEffect, useRef, useState } from 'react';
import { AuthorView, InstitutionView, JournalView, PaperView, EmptyState, type Detail } from './node-detail-views';
import { Ico } from './ui-primitives';

interface NodeDetailProps {
  nodeId: string | null;
  onClose: () => void;
  onBack?: () => void;
  empty?: React.ReactNode;
  accentColor?: string | null;
  navDir?: 'forward' | 'back';
}

// Module-level cache so hover-prefetch and the component share state.
// Stores settled Detail objects; in-flight promises are deduped in `inflight`.
const detailCache = new Map<string, Detail>();
const inflight = new Map<string, Promise<Detail>>();

function fetchDetail(id: string): Promise<Detail> {
  const cached = detailCache.get(id);
  if (cached) return Promise.resolve(cached);
  const existing = inflight.get(id);
  if (existing) return existing;
  const p = fetch(`/api/node-detail?id=${encodeURIComponent(id)}`)
    .then(async r => r.ok ? r.json() : Promise.reject((await r.json()).error || r.statusText))
    .then((d: Detail) => { detailCache.set(id, d); inflight.delete(id); return d; })
    .catch(e => { inflight.delete(id); throw e; });
  inflight.set(id, p);
  return p;
}

/** Seed the detail cache for a node the user is likely to click next.
 *  Safe to call repeatedly; dedupes in-flight and served from cache on hit. */
export function prefetchNodeDetail(id: string): void {
  fetchDetail(id).catch(() => { /* swallow — not user-initiated */ });
}

function useNodeDetail(id: string | null) {
  const [data, setData] = useState<Detail | null>(() => (id && detailCache.get(id)) || null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setError(null);
    if (!id) return;
    const cached = detailCache.get(id);
    if (cached) { setData(cached); return; }
    setData(null);
    let cancelled = false;
    fetchDetail(id)
      .then(d => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setError(String(e)); });
    return () => { cancelled = true; };
  }, [id]);
  return { data, error };
}

const EYEBROW_BY_GROUP: Record<string, string> = {
  author: 'Author', institution: 'Institution', journal: 'Journal', doi: 'Paper',
};

function DetailSkeleton({ nodeId }: { nodeId: string }) {
  const group = nodeId.split(':', 1)[0];
  const eyebrow = EYEBROW_BY_GROUP[group] ?? '';
  return (
    <div className="detail detail-skeleton" aria-busy="true">
      <div className="detail-head">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <div className="sk-bar sk-title" />
          <div className="sk-bar sk-subtitle" />
        </div>
      </div>
      <div className="detail-stats">
        <div><span className="sk-bar sk-stat" /><label>&nbsp;</label></div>
        <div><span className="sk-bar sk-stat" /><label>&nbsp;</label></div>
      </div>
      <div className="detail-section">
        <div className="detail-section-label">Recent papers</div>
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="detail-item">
            <div className="sk-bar sk-row" />
            <div className="sk-bar sk-row-sub" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function NodeDetail({ nodeId, onClose, onBack, empty, accentColor }: NodeDetailProps) {
  const { data, error } = useNodeDetail(nodeId);
  const fallback = empty ?? <EmptyState />;
  const style = accentColor ? ({ ['--detail-accent' as string]: accentColor } as React.CSSProperties) : undefined;
  const back = onBack ? (
    <button type="button" className="detail-back" onClick={onBack} aria-label="Back">
      {Ico.back}<span>Back</span>
    </button>
  ) : null;

  const detailBody = (() => {
    if (error) return <div className="detail-empty"><div className="status error">Error: {error}</div></div>;
    if (!nodeId) return null;
    if (!data) return <>{back}<DetailSkeleton nodeId={nodeId} /></>;
    const ch = data.type === 'author' ? <AuthorView d={data} onClose={onClose} />
      : data.type === 'institution' ? <InstitutionView d={data} onClose={onClose} />
      : data.type === 'journal' ? <JournalView d={data} onClose={onClose} />
      : data.type === 'paper' ? <PaperView d={data} onClose={onClose} />
      : null;
    return <>{back}{ch}</>;
  })();

  // Filmstrip: sidebar and detail sit side-by-side inside a track. The viewport
  // shows exactly one panel; toggling the showing-detail class translates the
  // track to slide adjacent panels in and out together.
  const showingDetail = !!nodeId;
  const accented = showingDetail && !!data && !error;

  // Keep the detail panel mounted for one full transition after navigating
  // back to the sidebar, so the exit animation has content to render.
  const [detailInDom, setDetailInDom] = useState(showingDetail);
  useEffect(() => {
    if (showingDetail) { setDetailInDom(true); return; }
    const t = setTimeout(() => setDetailInDom(false), 260);
    return () => clearTimeout(t);
  }, [showingDetail]);

  return (
    <div className={`node-detail-viewport${showingDetail ? ' showing-detail' : ''}`}>
      <div className="node-detail-track">
        <div className="node-detail-pane node-detail-home">{fallback}</div>
        <div className={`node-detail-pane node-detail-overlay${accented && accentColor ? ' detail-accented' : ''}`} style={accented ? style : undefined}>
          {detailInDom ? detailBody : null}
        </div>
      </div>
    </div>
  );
}
