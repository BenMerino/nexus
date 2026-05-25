import React, { useEffect, useRef, useState } from 'react';
import { hIndexTooltip } from './h-index-breakdown';

export interface AuthorRow {
  name: string;
  orcid: string | null;
  paperCount: number;
  totalCitations: number;
  hIndex: number;
  hIndexByType?: Record<string, number> | null;
}

interface AuthorsResponse {
  ok: boolean;
  rows: AuthorRow[];
  page: number;
  pageSize: number;
  totalCount: number;
  error?: string;
}

type SortKey = 'name' | 'paperCount' | 'hIndex' | 'totalCitations';
type Dir = 'asc' | 'desc';
interface Col { id: SortKey; label: string; numeric?: boolean }

const COLS: Col[] = [
  { id: 'name',           label: 'Name' },
  { id: 'paperCount',     label: 'Papers',    numeric: true },
  { id: 'hIndex',         label: 'h-index',   numeric: true },
  { id: 'totalCitations', label: 'Citations', numeric: true },
];

const PAGE_SIZE = 25;

export function AuthorsTable({ slug }: { slug: string }) {
  const [rows, setRows] = useState<AuthorRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<SortKey>('paperCount');
  const [dir, setDir] = useState<Dir>('desc');
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const reqIdRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refetch whenever page/sort/dir/q changes. Search input updates `q` from
  // a debounced handler so the URL state cleanly drives this effect.
  useEffect(() => {
    const id = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      page: String(page), pageSize: String(PAGE_SIZE), sort, dir,
    });
    if (q.trim()) params.set('q', q.trim());
    fetch(`/api/public/${encodeURIComponent(slug)}/authors?${params}`)
      .then(async r => {
        const j: AuthorsResponse = await r.json();
        if (!j.ok) throw new Error(j.error || `Failed (${r.status})`);
        if (reqIdRef.current !== id) return;
        setRows(j.rows);
        setTotalCount(j.totalCount);
      })
      .catch(e => { if (reqIdRef.current === id) setError(e.message || 'Failed to load'); })
      .finally(() => { if (reqIdRef.current === id) setLoading(false); });
  }, [slug, page, sort, dir, q]);

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
    <div>
      <div className="roster-toolbar">
        <input
          type="text"
          placeholder="search by name"
          defaultValue={q}
          onChange={e => onFilterChange(e.target.value)}
          style={{ marginLeft: 'auto', fontSize: 12, padding: '6px 10px', width: 280, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-inset)', color: 'var(--fg)' }}
        />
      </div>
      <div className="tableScroll">
        <table className="admin-table">
          <thead>
            <tr>
              {COLS.map(c => (
                <th key={c.id}
                    style={{ cursor: 'pointer', textAlign: c.numeric ? 'right' : 'left' }}
                    onClick={() => onSortClick(c.id)}>
                  {c.label}{arrow(c.id)}
                </th>
              ))}
              <th>ORCID</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a, i) => (
              <tr key={`${a.orcid || a.name}-${i}`}>
                <td>{a.name}</td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontVariantNumeric: 'tabular-nums' }}>{a.paperCount.toLocaleString()}</td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontVariantNumeric: 'tabular-nums' }} title={hIndexTooltip(a.hIndexByType)}>{a.hIndex}</td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontVariantNumeric: 'tabular-nums' }}>{a.totalCitations.toLocaleString()}</td>
                <td>{a.orcid
                  ? <a href={`https://orcid.org/${a.orcid}`} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{a.orcid}</a>
                  : <span className="text-muted text-small">none</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalCount === 0 && !loading
        ? <div className="text-muted text-small" style={{ padding: 14 }}>No matching authors.</div>
        : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
        <span className="text-small text-muted">
          {error ? `Error: ${error}` : totalCount === 0 ? 'No authors.' : `${start}–${end} of ${totalCount.toLocaleString()}`}
        </span>
        <span style={{ marginLeft: 'auto' }} />
        <button className="primary-btn" style={{ padding: '4px 12px' }}
                disabled={page <= 0 || loading}
                onClick={() => setPage(p => Math.max(0, p - 1))}>‹</button>
        <button className="primary-btn" style={{ padding: '4px 12px' }}
                disabled={end >= totalCount || loading}
                onClick={() => setPage(p => p + 1)}>›</button>
      </div>
    </div>
  );
}
