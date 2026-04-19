import React, { useState } from 'react';
import type { DoiRecord } from './relationship-types';

const PAGE_SIZE = 20;

function formatAuthors(authors: string[]): string {
  if (!authors?.length) return '—';
  if (authors.length <= 3) return authors.join(', ');
  return `${authors.slice(0, 3).join(', ')} et al.`;
}

const btnStyle: React.CSSProperties = {
  background: 'none', border: '1px solid #ddd', borderRadius: 4,
  cursor: 'pointer', fontSize: 12, color: '#555', fontFamily: 'monospace', padding: '4px 10px',
};

const cellStyle: React.CSSProperties = {
  padding: '4px 8px', fontSize: 11, fontFamily: 'monospace',
  borderBottom: '1px solid #f0f0f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
};

export function FilteredPaperList({ papers }: { papers: DoiRecord[] }) {
  const [expanded, setExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);

  if (!papers.length) return null;

  const sorted = [...papers].sort((a, b) => (b.citation_count || 0) - (a.citation_count || 0));
  const visible = showAll ? sorted : sorted.slice(0, PAGE_SIZE);
  const hasMore = sorted.length > PAGE_SIZE;

  return (
    <div style={{ marginTop: 12 }}>
      <button onClick={() => setExpanded(!expanded)} style={btnStyle}>
        {expanded ? 'Hide papers' : `Show ${papers.length} paper${papers.length !== 1 ? 's' : ''}`}
      </button>
      {expanded && (
        <div style={{ marginTop: 8, border: '1px solid #eee', borderRadius: 6, overflow: 'auto', maxHeight: 500 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fafafa', textAlign: 'left' }}>
                <th style={{ ...cellStyle, fontWeight: 700, width: '40%' }}>Title</th>
                <th style={{ ...cellStyle, fontWeight: 700, width: '25%' }}>Authors</th>
                <th style={{ ...cellStyle, fontWeight: 700, width: '10%' }}>Year</th>
                <th style={{ ...cellStyle, fontWeight: 700, width: '15%' }}>Journal</th>
                <th style={{ ...cellStyle, fontWeight: 700, width: '10%', textAlign: 'right' }}>Cited</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(r => (
                <tr key={r.doi} style={{ cursor: 'default' }}>
                  <td style={{ ...cellStyle, whiteSpace: 'normal', maxWidth: 300 }}>
                    <a href={`https://doi.org/${r.doi}`} target="_blank" rel="noopener noreferrer"
                      style={{ color: '#2563eb', textDecoration: 'none' }}
                      title={r.title || r.doi}>
                      {(r.title || r.doi).substring(0, 80)}{(r.title || r.doi).length > 80 ? '...' : ''}
                    </a>
                  </td>
                  <td style={cellStyle} title={r.authors?.join(', ')}>{formatAuthors(r.authors)}</td>
                  <td style={cellStyle}>{r.published ? r.published.substring(0, 4) : '—'}</td>
                  <td style={cellStyle} title={r.journal}>{r.journal ? r.journal.substring(0, 25) : '—'}</td>
                  <td style={{ ...cellStyle, textAlign: 'right' }}>{r.citation_count ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {hasMore && !showAll && (
            <div style={{ padding: 8, textAlign: 'center' }}>
              <button onClick={() => setShowAll(true)} style={{ ...btnStyle, border: 'none', color: '#2563eb' }}>
                Show all {sorted.length} papers
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
