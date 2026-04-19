import React, { useMemo, useState } from 'react';

export interface AuthorRow {
  name: string;
  orcid: string | null;
  paperCount: number;
  totalCitations: number;
  hIndex: number;
}

type SortKey = 'name' | 'paperCount' | 'hIndex' | 'totalCitations';

function compare(a: AuthorRow, b: AuthorRow, key: SortKey, asc: boolean): number {
  const dir = asc ? 1 : -1;
  if (key === 'name') return a.name.localeCompare(b.name) * dir;
  return ((a[key] as number) - (b[key] as number)) * dir;
}

export function AuthorsTable({ authors }: { authors: AuthorRow[] }) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('paperCount');
  const [asc, setAsc] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = q ? authors.filter(a => a.name.toLowerCase().includes(q)) : authors;
    return rows.slice().sort((a, b) => compare(a, b, sortKey, asc));
  }, [authors, query, sortKey, asc]);

  const onSort = (key: SortKey) => {
    if (sortKey === key) setAsc(!asc);
    else { setSortKey(key); setAsc(key === 'name'); }
  };

  const arrow = (key: SortKey) => sortKey === key ? (asc ? ' ↑' : ' ↓') : '';

  return (
    <div>
      <div className="authors-toolbar">
        <input
          placeholder="Filter by name…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <span style={{ fontSize: 12, color: '#666' }}>
          {filtered.length.toLocaleString()} of {authors.length.toLocaleString()}
        </span>
      </div>
      <table className="authors-table">
        <thead>
          <tr>
            <th onClick={() => onSort('name')}>Name{arrow('name')}</th>
            <th>ORCID</th>
            <th onClick={() => onSort('paperCount')} style={{ textAlign: 'right' }}>Papers{arrow('paperCount')}</th>
            <th onClick={() => onSort('hIndex')} style={{ textAlign: 'right' }}>h-index{arrow('hIndex')}</th>
            <th onClick={() => onSort('totalCitations')} style={{ textAlign: 'right' }}>Citations{arrow('totalCitations')}</th>
          </tr>
        </thead>
        <tbody>
          {filtered.slice(0, 500).map((a, i) => (
            <tr key={i}>
              <td>{a.name}</td>
              <td>
                {a.orcid ? (
                  <a href={`https://orcid.org/${a.orcid}`} target="_blank" rel="noopener noreferrer">
                    {a.orcid}
                  </a>
                ) : <span style={{ color: '#ccc' }}>—</span>}
              </td>
              <td className="num">{a.paperCount.toLocaleString()}</td>
              <td className="num">{a.hIndex}</td>
              <td className="num">{a.totalCitations.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtered.length > 500 ? (
        <div style={{ fontSize: 12, color: '#666', marginTop: 8 }}>
          Showing first 500 of {filtered.length.toLocaleString()}. Refine the filter to narrow down.
        </div>
      ) : null}
    </div>
  );
}
