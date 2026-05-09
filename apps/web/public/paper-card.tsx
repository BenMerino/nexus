import React, { useState, useEffect } from 'react';
import type { DoiRecord } from './relationship-types';

export function PaperCard({ doi, onClose, style, onHoverEnter, onHoverLeave }: {
  doi: string; onClose: () => void; style: React.CSSProperties;
  onHoverEnter?: () => void; onHoverLeave?: () => void;
}) {
  const [record, setRecord] = useState<DoiRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/records/${encodeURIComponent(doi)}`)
      .then(r => r.json())
      .then(d => { if (d && !d.error) setRecord(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [doi]);

  return (
    <div onMouseEnter={onHoverEnter} onMouseLeave={onHoverLeave} style={{
      ...style, width: 340, boxSizing: 'border-box',
      background: 'rgba(255,255,255,0.4)',
      backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
      border: '1.5px solid rgba(100,100,100,0.3)',
      borderRadius: 10, padding: '12px 14px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.6)',
      fontFamily: 'monospace', zIndex: 20,
      animation: 'card-expand 250ms ease-out',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#222', lineHeight: '18px', flex: 1, wordBreak: 'break-word' }}>
          {record?.title || doi}
        </div>
        <button onClick={(e) => { e.stopPropagation(); onClose(); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#999', padding: '0 0 0 8px', lineHeight: 1 }}>
          x
        </button>
      </div>

      {loading && <div style={{ fontSize: 11, color: '#999' }}>Loading...</div>}

      {record && (
        <div style={{ fontSize: 11, color: '#555' }}>
          {record.authors && record.authors.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, color: '#c62828', fontWeight: 700 }}>Authors</span>
              <div style={{ color: '#444', marginTop: 2 }}>{record.authors.slice(0, 5).join(', ')}{record.authors.length > 5 ? ` +${record.authors.length - 5}` : ''}</div>
            </div>
          )}
          {record.journal && (
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, color: '#2e7d32', fontWeight: 700 }}>Journal</span>
              <div style={{ color: '#444', marginTop: 2 }}>{record.journal}</div>
            </div>
          )}
          {record.abstract && (
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, color: '#1565c0', fontWeight: 700 }}>Abstract</span>
              <div style={{ color: '#444', marginTop: 2, maxHeight: 120, overflowY: 'auto', lineHeight: '15px', fontFamily: 'system-ui, sans-serif', fontSize: 11 }}>
                {record.abstract.length > 600 ? record.abstract.substring(0, 600) + '\u2026' : record.abstract}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 14, marginBottom: 6, flexWrap: 'wrap' }}>
            {record.published && (
              <span><span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, color: '#888', fontWeight: 700 }}>Year </span><strong style={{ color: '#333' }}>{record.published.substring(0, 4)}</strong></span>
            )}
            {record.citation_count > 0 && (
              <span><span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, color: '#888', fontWeight: 700 }}>Citations </span><strong style={{ color: '#333' }}>{record.citation_count}</strong></span>
            )}
            {record.type && (
              <span><span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, color: '#888', fontWeight: 700 }}>Type </span><span style={{ color: '#333' }}>{record.type}</span></span>
            )}
          </div>
        </div>
      )}

      <a href={`https://doi.org/${doi}`} target="_blank" rel="noopener noreferrer"
        style={{ display: 'inline-block', fontSize: 10, color: '#1565c0', marginTop: 4, textDecoration: 'none' }}>
        {doi} ↗
      </a>
    </div>
  );
}
