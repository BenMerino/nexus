import React, { useEffect, useRef, useState } from 'react';

export interface AcademicHit {
  name: string;
  orcid: string;
  position?: string | null;
  faculty?: string | null;
  grade?: string | null;
}

export function SidebarSearch() {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<AcademicHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setHits([]); setLoading(false); return; }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search-academics?q=${encodeURIComponent(term)}`, { signal: ctrl.signal })
        .then(r => r.ok ? r.json() : [])
        .then((rows: AcademicHit[]) => { setHits(rows); setLoading(false); })
        .catch(() => { /* aborted or error */ });
    }, 180);
    return () => { ctrl.abort(); clearTimeout(t); };
  }, [q]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function go(h: AcademicHit) {
    window.location.href = `/dashboard.html?orcid=${encodeURIComponent(h.orcid)}`;
  }

  const showResults = open && q.trim().length >= 2;
  return (
    <div className="sidebar-search" ref={wrapRef}>
      <input
        type="search"
        className="sidebar-search-input"
        placeholder="Search academics..."
        value={q}
        onChange={e => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />
      {showResults && (
        <div className="sidebar-search-results">
          {loading && hits.length === 0 && <div className="sidebar-search-empty">Searching…</div>}
          {!loading && hits.length === 0 && <div className="sidebar-search-empty">No matches</div>}
          {hits.map(h => (
            <button key={h.orcid} type="button" className="sidebar-search-hit" onClick={() => go(h)}>
              <div className="sidebar-search-hit-name">{h.name}</div>
              <div className="sidebar-search-hit-meta">
                {[h.position, h.faculty].filter(Boolean).join(' · ') || h.orcid}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
