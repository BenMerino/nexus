import React, { useState } from 'react';
import type { DoiRecord } from './relationship-types';
import { BaseAction } from '../ui/primitives';

const PAGE_SIZE = 20;

function formatAuthors(authors: string[]): string {
  if (!authors?.length) return '—';
  if (authors.length <= 3) return authors.join(', ');
  return `${authors.slice(0, 3).join(', ')} et al.`;
}

const cellStyle: React.CSSProperties = {
  padding: '8px 10px', fontSize: 'var(--text-label)', fontFamily: 'var(--mono)',
  borderBottom: '1px solid var(--border-soft)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  color: 'var(--fg-muted)',
};

export function FilteredPaperList({ papers }: { papers: DoiRecord[] }) {
  const [expanded, setExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);

  if (!papers.length) return null;

  const sorted = [...papers].sort((a, b) => (b.citation_count || 0) - (a.citation_count || 0));
  const visible = showAll ? sorted : sorted.slice(0, PAGE_SIZE);
  const hasMore = sorted.length > PAGE_SIZE;

  return (
    <div style={{ marginTop: 14 }}>
      <BaseAction variant="secondary" size="sm" onClick={() => setExpanded(!expanded)}>
        {expanded ? 'Hide papers' : `Show ${papers.length} paper${papers.length !== 1 ? 's' : ''}`}
      </BaseAction>
      {expanded && (
        <div style={{ marginTop: 10, border: '1px solid var(--border-soft)', borderRadius: 'var(--radius)', overflow: 'auto', maxHeight: 500, background: 'var(--bg-card)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-inset)', textAlign: 'left' }}>
                <th style={{ ...cellStyle, fontWeight: 'var(--weight-label)', width: '40%', color: 'var(--fg-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: 'var(--text-micro)' }}>Title</th>
                <th style={{ ...cellStyle, fontWeight: 'var(--weight-label)', width: '25%', color: 'var(--fg-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: 'var(--text-micro)' }}>Authors</th>
                <th style={{ ...cellStyle, fontWeight: 'var(--weight-label)', width: '10%', color: 'var(--fg-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: 'var(--text-micro)' }}>Year</th>
                <th style={{ ...cellStyle, fontWeight: 'var(--weight-label)', width: '15%', color: 'var(--fg-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: 'var(--text-micro)' }}>Journal</th>
                <th style={{ ...cellStyle, fontWeight: 'var(--weight-label)', width: '10%', textAlign: 'right', color: 'var(--fg-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: 'var(--text-micro)' }}>Cited</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(r => (
                <tr key={r.doi} style={{ cursor: 'default' }}>
                  <td style={{ ...cellStyle, whiteSpace: 'normal', maxWidth: 300, color: 'var(--fg)' }}>
                    <a href={`https://doi.org/${r.doi}`} target="_blank" rel="noopener noreferrer"
                      style={{ color: 'var(--accent)', textDecoration: 'none' }}
                      title={r.title || r.doi}>
                      {(r.title || r.doi).substring(0, 80)}{(r.title || r.doi).length > 80 ? '…' : ''}
                    </a>
                  </td>
                  <td style={cellStyle} title={r.authors?.join(', ')}>{formatAuthors(r.authors)}</td>
                  <td style={cellStyle}>{r.published ? r.published.substring(0, 4) : '—'}</td>
                  <td style={cellStyle} title={r.journal}>{r.journal ? r.journal.substring(0, 25) : '—'}</td>
                  <td style={{ ...cellStyle, textAlign: 'right', color: 'var(--fg)' }}>{r.citation_count ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {hasMore && !showAll && (
            <div style={{ padding: 10, textAlign: 'center' }}>
              <BaseAction variant="ghost" size="sm" onClick={() => setShowAll(true)}
                style={{ color: 'var(--accent)' }}>
                Show all {sorted.length} papers
              </BaseAction>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
