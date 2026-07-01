import React, { useEffect, useRef, useState } from 'react';
import { BaseAction } from '../ui/primitives';
import { PAGE_SIZE, JournalRow, JournalRowSkeleton, type Journal, type JournalsResponse } from './tenant-journals-shared';

type SortKey = 'name' | 'paperCount' | 'citationCount';
type Dir = 'asc' | 'desc';
const COLS: { id: SortKey; label: string; numeric?: boolean }[] = [
  { id: 'name', label: 'Journal' },
  { id: 'paperCount', label: 'Papers', numeric: true },
  { id: 'citationCount', label: 'Cites', numeric: true },
];

/* The Journals-by-area drill-in: one area's venues on the roster's .admin-table
 * (same table UI as AuthorsTable — sortable headers, .roster-search,
 * .tableScroll), server-paged/sorted (?area=&page=&pageSize=&sort=&dir= — a
 * tenant can carry thousands of venues in one area). Split out of
 * tenant-journals.tsx to keep both files under N5. */
export function AreaDetail({ slug, area, back }: { slug: string; area: string; back: () => void }) {
  const [journals, setJournals] = useState<Journal[] | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<SortKey>('paperCount');
  const [dir, setDir] = useState<Dir>('desc');
  const [q, setQ] = useState('');
  const reqIdRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const id = ++reqIdRef.current;
    setJournals(null);
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), area, sort, dir });
    if (q.trim()) params.set('q', q.trim());
    fetch(`/api/public/${encodeURIComponent(slug)}/journals?${params}`)
      .then(r => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((d: JournalsResponse) => {
        if (reqIdRef.current !== id) return;
        setJournals(d.journals);
        setTotalCount(d.totalCount);
      });
  }, [slug, area, page, sort, dir, q]);

  function onSortClick(id: SortKey) {
    if (sort === id) setDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSort(id); setDir(id === 'name' ? 'asc' : 'desc'); }
    setPage(0);
  }

  function onFilterChange(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setQ(value); setPage(0); }, 250);
  }

  const start = totalCount === 0 ? 0 : page * PAGE_SIZE + 1;
  const end = Math.min(totalCount, (page + 1) * PAGE_SIZE);
  const arrow = (id: SortKey) => sort === id ? (dir === 'asc' ? ' ▲' : ' ▼') : '';

  return (
    <>
      <a className="profile-back" onClick={(e) => { e.preventDefault(); back(); }} href="#">← Areas</a>
      <h1 className="view-title" style={{ margin: '6px 0 18px' }}>{area}</h1>
      <div className="roster-toolbar">
        <input type="text" className="roster-search" placeholder="Search journals…"
          defaultValue={q} onChange={e => onFilterChange(e.target.value)}
          style={{ marginLeft: 'auto', width: 280 }} />
      </div>
      <div className="tableScroll">
        <table className="admin-table">
          <thead>
            <tr>
              {COLS.map(c => (
                <th key={c.id} style={{ cursor: 'pointer', textAlign: c.numeric ? 'right' : 'left' }}
                  onClick={() => onSortClick(c.id)}>
                  {c.label}{arrow(c.id)}
                </th>
              ))}
              <th>ISSN</th>
              <th>Indexation</th>
            </tr>
          </thead>
          <tbody>
            {journals
              ? journals.map(j => <JournalRow key={j.id} j={j} />)
              : Array.from({ length: 8 }).map((_, i) => <JournalRowSkeleton key={i} />)}
          </tbody>
        </table>
      </div>
      {journals && journals.length === 0 && <div className="text-muted text-small" style={{ padding: 14 }}>No journals match.</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
        <span className="text-small text-muted">
          {totalCount === 0 ? '' : `${start.toLocaleString()}–${end.toLocaleString()} of ${totalCount.toLocaleString()}`}
        </span>
        <span style={{ marginLeft: 'auto' }} />
        <BaseAction variant="secondary" size="sm"
          disabled={page <= 0} onClick={() => setPage(p => Math.max(0, p - 1))}>‹</BaseAction>
        <BaseAction variant="secondary" size="sm"
          disabled={end >= totalCount} onClick={() => setPage(p => p + 1)}>›</BaseAction>
      </div>
    </>
  );
}
