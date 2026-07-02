import React, { useEffect, useRef, useState } from 'react';
import { SearchField } from '../ui/composed/SearchField';
import { Popover } from '../ui/composed/Popover';

export interface AcademicHit {
  name: string;
  orcid: string;
  position?: string | null;
  faculty?: string | null;
  grade?: string | null;
}

/* Sidebar omnibox over academics (server, /search-academics). Built on the
 * vendored composed layer: SearchField (input shell) + Popover (positioning,
 * portal, click-outside, Escape, glass-reveal) replace the old hand-rolled
 * .sidebar-search-input + wrapRef mousedown effect. The fetch/debounce/abort
 * logic and the .sidebar-search-* class hooks are unchanged. */

export function SidebarSearch() {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<AcademicHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [width, setWidth] = useState<number>();
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

  function go(h: AcademicHit) {
    window.location.href = `/dashboard.html?orcid=${encodeURIComponent(h.orcid)}`;
  }

  const showResults = open && q.trim().length >= 2;
  // The panel portals to <body> and is positioned `fixed`, so a CSS `width:100%`
  // would resolve against the viewport, not the sidebar. Match the trigger's
  // measured width so the dropdown sits flush under the input.
  useEffect(() => {
    if (showResults && wrapRef.current) setWidth(wrapRef.current.offsetWidth);
  }, [showResults]);

  return (
    <Popover
      open={showResults}
      onOpenChange={setOpen}
      panelClassName="sidebar-search-results"
      panelStyle={{ width }}
      trigger={({ ref }) => (
        <div className="sidebar-search"
          ref={(el) => { (ref as React.MutableRefObject<HTMLDivElement | null>).current = el; wrapRef.current = el; }}
          onFocusCapture={() => setOpen(true)}>
          <SearchField value={q} onChange={(v) => { setQ(v); setOpen(true); }}
            placeholder="Search academics..." />
        </div>
      )}
    >
      {(close) => (
        <>
          {loading && hits.length === 0 && <div className="sidebar-search-empty">Searching…</div>}
          {!loading && hits.length === 0 && <div className="sidebar-search-empty">No matches</div>}
          {hits.map(h => (
            <button key={h.orcid} type="button" className="sidebar-search-hit"
              onClick={() => { go(h); close(); }}>
              <div className="sidebar-search-hit-name">{h.name}</div>
              <div className="sidebar-search-hit-meta">
                {[h.position, h.faculty].filter(Boolean).join(' · ') || h.orcid}
              </div>
            </button>
          ))}
        </>
      )}
    </Popover>
  );
}
