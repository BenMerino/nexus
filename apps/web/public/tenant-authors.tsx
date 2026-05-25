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

export interface AuthorsPage {
  data: AuthorRow[];
  pagination: { total: number; limit: number; offset: number; has_more: boolean; next_offset: number | null };
}

const PAGE_SIZE = 50;

// Server-side paginated + searchable directory. Sort is fixed at
// paperCount-desc on the backend; client-side resorting was dropped along
// with the dump-everything endpoint, since once you're paginated you
// can't re-sort just the current page without lying about the order.
export function AuthorsTable({ slug }: { slug: string }) {
  const [rows, setRows] = useState<AuthorRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reqIdRef = useRef(0);

  // Debounce search input — 250 ms after typing stops, reset and refetch.
  useEffect(() => {
    const timer = setTimeout(() => {
      setOffset(0);
      void fetchPage(0, query, /* replace */ true);
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function fetchPage(nextOffset: number, q: string, replace: boolean) {
    const myReq = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(nextOffset) });
      if (q.trim()) params.set('q', q.trim());
      const r = await fetch(`/api/public/${encodeURIComponent(slug)}/authors?${params}`);
      if (!r.ok) throw new Error(`Failed (${r.status})`);
      const page: AuthorsPage = await r.json();
      if (reqIdRef.current !== myReq) return; // stale — newer request in flight
      setRows(prev => replace ? page.data : [...prev, ...page.data]);
      setTotal(page.pagination.total);
      setOffset(page.pagination.offset + page.data.length);
      setHasMore(page.pagination.has_more);
    } catch (e: any) {
      if (reqIdRef.current === myReq) setError(e.message || 'Failed to load authors');
    } finally {
      if (reqIdRef.current === myReq) setLoading(false);
    }
  }

  return (
    <div>
      <div className="authors-toolbar">
        <input
          placeholder="Search by name…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <span style={{ fontSize: 12, color: '#666' }}>
          {loading && rows.length === 0
            ? 'Loading…'
            : `${rows.length.toLocaleString()} of ${total.toLocaleString()}`}
        </span>
      </div>
      <table className="authors-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>ORCID</th>
            <th style={{ textAlign: 'right' }}>Papers ↓</th>
            <th style={{ textAlign: 'right' }}>h-index</th>
            <th style={{ textAlign: 'right' }}>Citations</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a, i) => (
            <tr key={`${a.orcid || a.name}-${i}`}>
              <td>{a.name}</td>
              <td>
                {a.orcid ? (
                  <a href={`https://orcid.org/${a.orcid}`} target="_blank" rel="noopener noreferrer">
                    {a.orcid}
                  </a>
                ) : <span style={{ color: '#ccc' }}>—</span>}
              </td>
              <td className="num">{a.paperCount.toLocaleString()}</td>
              <td className="num" title={hIndexTooltip(a.hIndexByType)}>{a.hIndex}</td>
              <td className="num">{a.totalCitations.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {error ? (
        <div style={{ fontSize: 12, color: 'var(--danger, #c00)', marginTop: 8 }}>{error}</div>
      ) : null}
      {hasMore ? (
        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <button
            onClick={() => fetchPage(offset, query, /* replace */ false)}
            disabled={loading}
            style={{ padding: '6px 14px', fontFamily: 'var(--mono)', fontSize: 12 }}
          >
            {loading ? 'Loading…' : `Load more (${(total - rows.length).toLocaleString()} remaining)`}
          </button>
        </div>
      ) : !loading && rows.length === 0 ? (
        <div style={{ fontSize: 12, color: '#666', marginTop: 8 }}>No matching authors.</div>
      ) : null}
    </div>
  );
}
