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
        placeholder="Search nodes…"
        style={{ fontFamily: 'var(--mono)', fontSize: 'var(--text-label)', padding: '6px 10px', width: 180 }} />
      {open && matches.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 10,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          maxHeight: 240, overflow: 'auto', width: 280, marginTop: 4,
        }}>
          {matches.map(n => (
            <div key={n.id} tabIndex={0}
              onMouseDown={(e) => { e.preventDefault(); onSelect(n.id); setQuery(''); setOpen(false); }}
              style={{
                padding: '6px 10px', cursor: 'pointer', fontSize: 'var(--text-micro)', fontFamily: 'var(--mono)',
                display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border-soft)',
                color: 'var(--fg)',
              }}
              onMouseOver={e => (e.currentTarget.style.background = 'var(--bg-elev)')}
              onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[n.group], flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.label}</span>
              <span style={{ color: 'var(--fg-dim)', fontSize: 'var(--text-micro)', marginLeft: 'auto' }}>{n.group}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
