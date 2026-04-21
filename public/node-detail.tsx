import React, { useEffect, useState } from 'react';
import { AuthorView, InstitutionView, JournalView, PaperView, EmptyState, type Detail } from './node-detail-views';
import { Ico } from './ui-primitives';

interface NodeDetailProps {
  nodeId: string | null;
  onClose: () => void;
  onBack?: () => void;
  empty?: React.ReactNode;
  accentColor?: string | null;
}

function useNodeDetail(id: string | null) {
  // Keep the previous detail visible while fetching a new one — swap in place
  // when the fetch lands. Prevents a "Loading…" flash on every selection.
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!id) { setData(null); setError(null); return; }
    let cancelled = false;
    setError(null);
    fetch(`/api/node-detail?id=${encodeURIComponent(id)}`)
      .then(async r => r.ok ? r.json() : Promise.reject((await r.json()).error || r.statusText))
      .then(d => { if (!cancelled) setData(d as Detail); })
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
  return (
    <div key={key} className={`node-detail-swap${accented && accentColor ? ' detail-accented' : ''}`} style={accented ? style : undefined}>
      {content}
    </div>
  );
}
