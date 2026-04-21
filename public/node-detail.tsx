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
  if (!nodeId) return <>{fallback}</>;
  if (error) return <div className="detail-empty"><div className="status error">Error: {error}</div></div>;
  if (!data) return <>{fallback}</>;
  const style = accentColor ? ({ ['--detail-accent' as string]: accentColor } as React.CSSProperties) : undefined;
  const back = onBack ? (
    <button type="button" className="detail-back" onClick={onBack} aria-label="Back">
      {Ico.back}<span>Back</span>
    </button>
  ) : null;
  const wrap = (child: React.ReactNode) => (
    <div className={accentColor ? 'detail-accented' : undefined} style={style}>
      {back}{child}
    </div>
  );
  if (data.type === 'author') return wrap(<AuthorView d={data} onClose={onClose} />);
  if (data.type === 'institution') return wrap(<InstitutionView d={data} onClose={onClose} />);
  if (data.type === 'journal') return wrap(<JournalView d={data} onClose={onClose} />);
  if (data.type === 'paper') return wrap(<PaperView d={data} onClose={onClose} />);
  return null;
}
