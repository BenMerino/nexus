import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ES } from './tenant-i18n';

/* Unit picker — the scope lens for the Overview. Philosophy #1 ("scope is
 * sovereign"): picking a faculty/department re-narrows the SAME dashboard in
 * place, the way personal scope narrows by ORCID. Default is the whole tenant.
 * Fed by the public org-tree endpoint (faculties → departments, each carrying a
 * unitKey). A searchable grouped list so a long roster stays navigable. */

export interface UnitOption { unitKey: string | null; name: string; kind: string; depth: 0 | 1; }

interface OrgNode { name: string; unitKey: string | null; departments?: { name: string; unitKey: string }[]; }
interface OrgTree { faculties: OrgNode[]; }

// Flatten the org tree into a grouped, selectable option list: each academic
// faculty/institute (depth 0) followed by its departments (depth 1). "Otras
// unidades" (no faculty-level key) contributes only its departments.
function toOptions(tree: OrgTree): UnitOption[] {
  const opts: UnitOption[] = [];
  for (const f of tree.faculties) {
    if (f.unitKey) opts.push({ unitKey: f.unitKey, name: f.name, kind: 'faculty', depth: 0 });
    for (const d of f.departments ?? []) {
      if (d.unitKey) opts.push({ unitKey: d.unitKey, name: d.name, kind: 'dept', depth: 1 });
    }
  }
  return opts;
}

export function UnitPicker({ slug, value, onChange }: {
  slug: string; value: UnitOption | null; onChange: (u: UnitOption | null) => void;
}) {
  const [options, setOptions] = useState<UnitOption[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/public/${encodeURIComponent(slug)}/org-tree`)
      .then(r => (r.ok ? r.json() as Promise<OrgTree> : Promise.reject(r.status)))
      .then(t => setOptions(toOptions(t)))
      .catch(() => setOptions([]));
  }, [slug]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.name.toLowerCase().includes(q));
  }, [options, query]);

  const label = value ? value.name : ES.unitPicker.allTenant;

  const pick = (u: UnitOption | null) => { onChange(u); setOpen(false); setQuery(''); };

  if (!options.length) return null; // no roster → no picker (overview stays tenant-wide)

  return (
    <div ref={ref} className="unit-picker" style={{ position: 'relative', marginBottom: '1.25rem', maxWidth: 420 }}>
      <button type="button" onClick={() => setOpen(o => !o)} className="unit-picker-trigger"
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
          background: 'var(--surface, var(--bg))', border: '1px solid var(--border)', borderRadius: 8,
          padding: '9px 12px', cursor: 'pointer', color: 'var(--fg)', fontFamily: 'var(--mono)', fontSize: 13 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ color: 'var(--fg-dim)', fontSize: 11 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open ? (
        <div className="unit-picker-menu"
          style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 30,
            background: 'var(--surface, var(--bg))', border: '1px solid var(--border)', borderRadius: 8,
            boxShadow: '0 8px 28px rgba(0,0,0,0.18)', maxHeight: 360, overflowY: 'auto', padding: 6 }}>
          <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder={ES.unitPicker.search}
            style={{ width: '100%', boxSizing: 'border-box', marginBottom: 6, padding: '7px 9px',
              background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6,
              color: 'var(--fg)', fontFamily: 'var(--mono)', fontSize: 12 }} />
          <Row label={ES.unitPicker.allTenant} active={!value} depth={0} strong onClick={() => pick(null)} />
          {filtered.map(o => (
            <Row key={o.unitKey} label={o.name} depth={o.depth}
              active={value?.unitKey === o.unitKey} onClick={() => pick(o)} />
          ))}
          {!filtered.length ? <div style={{ padding: '8px 10px', color: 'var(--fg-dim)', fontSize: 12, fontFamily: 'var(--mono)' }}>{ES.unitPicker.noMatch}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, depth, active, strong, onClick }: {
  label: string; depth: 0 | 1; active: boolean; strong?: boolean; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick}
      style={{ width: '100%', textAlign: 'left', display: 'block', cursor: 'pointer',
        padding: `6px 10px 6px ${10 + depth * 18}px`, border: 'none', borderRadius: 6,
        background: active ? 'var(--primary-soft, rgba(0,0,0,0.06))' : 'transparent',
        color: active ? 'var(--primary)' : 'var(--fg)',
        fontFamily: 'var(--mono)', fontSize: 12.5, fontWeight: strong ? 600 : (depth === 0 ? 500 : 400) }}>
      {depth === 1 ? <span style={{ color: 'var(--fg-dim)', marginRight: 6 }}>·</span> : null}{label}
    </button>
  );
}
