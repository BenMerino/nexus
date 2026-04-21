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

function useNodeDetail(id: string | null) {
  // Cache fetched details so going back and re-entering the same node
  // returns instantly (no refetch, no remount, no animation replay).
  const cacheRef = useRef<Map<string, Detail>>(new Map());
  const [data, setData] = useState<Detail | null>(() => (id && cacheRef.current.get(id)) || null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setError(null);
    if (!id) return; // keep data as-is; wrapper will render the empty state anyway
    const cached = cacheRef.current.get(id);
    if (cached) { setData(cached); return; }
    setData(null);
    let cancelled = false;
    fetch(`/api/node-detail?id=${encodeURIComponent(id)}`)
      .then(async r => r.ok ? r.json() : Promise.reject((await r.json()).error || r.statusText))
      .then(d => { if (!cancelled) { cacheRef.current.set(id, d as Detail); setData(d as Detail); } })
      .catch(e => { if (!cancelled) setError(String(e)); });
    return () => { cancelled = true; };
  }, [id]);
  return { data, error };
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
    if (!nodeId || !data) return null;
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
