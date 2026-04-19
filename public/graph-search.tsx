import React, { useState, useMemo } from 'react';
import { COLORS } from './relationship-types';

export function GraphSearch({ nodes, onSelect }: {
  nodes: { id: string; label: string; group: string }[];
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    return nodes.filter(n => n.group !== 'doi' && n.label.toLowerCase().includes(q)).slice(0, 8);
  }, [query, nodes]);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false); }}>
      <input value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search nodes\u2026"
        style={{ fontFamily: 'monospace', fontSize: 12, padding: '4px 8px', border: '1px solid #ddd', borderRadius: 4, width: 170 }} />
      {open && matches.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 10, background: '#fff',
          border: '1px solid #ddd', borderRadius: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          maxHeight: 200, overflow: 'auto', width: 260, marginTop: 2,
        }}>
          {matches.map(n => (
            <div key={n.id} tabIndex={0}
              onMouseDown={(e) => { e.preventDefault(); onSelect(n.id); setQuery(''); setOpen(false); }}
              style={{
                padding: '4px 8px', cursor: 'pointer', fontSize: 11, fontFamily: 'monospace',
                display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid #f5f5f5',
              }}
              onMouseOver={e => (e.currentTarget.style.background = '#f5f5f5')}
              onMouseOut={e => (e.currentTarget.style.background = '#fff')}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[n.group], flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.label}</span>
              <span style={{ color: '#999', fontSize: 10, marginLeft: 'auto' }}>{n.group}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
