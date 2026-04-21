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
    // Unknown id: clear so we don't briefly render the previous detail
    // into the new wrapper while the fetch is in flight.
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

export function NodeDetail({ nodeId, onClose, onBack, empty, accentColor, navDir = 'forward' }: NodeDetailProps) {
  const { data, error } = useNodeDetail(nodeId);
  const fallback = empty ?? <EmptyState />;
  const style = accentColor ? ({ ['--detail-accent' as string]: accentColor } as React.CSSProperties) : undefined;
  const back = onBack ? (
    <button type="button" className="detail-back" onClick={onBack} aria-label="Back">
      {Ico.back}<span>Back</span>
    </button>
  ) : null;
  // Key identifies the current view so React remounts the wrapper on every
  // state change — lets the CSS fade-in fire for each swap.
  const contentFor = (): { key: string; content: React.ReactNode; accented: boolean } => {
    // Treat "no selection" and "selection pending fetch" as the same view so
    // the fallback doesn't remount (and re-fade) between them.
    if (!nodeId || !data) {
      if (error) return { key: 'error', content: <div className="detail-empty"><div className="status error">Error: {error}</div></div>, accented: false };
      return { key: 'empty', content: fallback, accented: false };
    }
    const ch = data.type === 'author' ? <AuthorView d={data} onClose={onClose} />
      : data.type === 'institution' ? <InstitutionView d={data} onClose={onClose} />
      : data.type === 'journal' ? <JournalView d={data} onClose={onClose} />
      : data.type === 'paper' ? <PaperView d={data} onClose={onClose} />
      : null;
    // Key off the data itself so we only remount when the fetched detail
    // actually changes — not transiently while nodeId has advanced but
    // data is still the previous view.
    const dataId = (data as { doi?: string; orcid?: string; ror?: string; issn?: string }).doi
      ?? (data as { orcid?: string }).orcid
      ?? (data as { ror?: string }).ror
      ?? (data as { issn?: string }).issn
      ?? data.type;
    return { key: `${data.type}:${dataId}`, content: <>{back}{ch}</>, accented: true };
  };
  const { key, content, accented } = contentFor();
  const dirClass = navDir === 'back' ? 'slide-back' : 'slide-forward';
  return (
    <div key={key} className={`node-detail-swap ${dirClass}${accented && accentColor ? ' detail-accented' : ''}`} style={accented ? style : undefined}>
      {content}
    </div>
  );
}
