import React, { useEffect, useMemo, useState } from 'react';
import { ES } from './tenant-i18n';
import { type Metric, type Person, type Unit, METRICS, valueOf, rank, Bar, PersonRow } from './tenant-org-row';

/* The org scheme IS both the contributors ranking AND the scope picker. Each
 * faculty/department row carries an inline metric bar, is sorted by it, and is
 * SELECTABLE — clicking it re-scopes the right-side Overview to that unit. An
 * "All organization" row at the top resets scope. The twist (▶) toggles
 * expand/drill; the rest of the row selects. Metric toggle switches Publications
 * / Per academic / Citations. Reads the org-tree payload (papers + citations +
 * headcount). Row primitives live in tenant-org-row.tsx (size cap). */

// The scope a selected unit carries (shared with tenant.tsx / Overview).
export interface UnitScope { unitKey: string; name: string; }

interface Department extends Unit { unitKey: string; people: Person[]; }
interface Faculty extends Unit { kind: 'faculty' | 'institute' | 'other'; departments: Department[]; }
interface OrgTree {
  totals: { headcount: number; withOrcid: number; papers: number; citations: number; faculties: number; institutes: number; units: number; };
  faculties: Faculty[];
}

const KIND_LABEL = ES.orgTree.kindLabel;

// A selectable unit row. Twist toggles expand (drill); the label+bar selects
// (re-scopes). Active when its unitKey is the current scope. `tag` (kind label)
// is its OWN fixed-width flex cell so every tag aligns into one column,
// independent of name length — never glued to the end of the name.
function Branch({ label, cls, tag, value, max, metric, unitKey, name, selected, onSelect, children }: {
  label: React.ReactNode; cls: string; tag?: string; value: number; max: number; metric: Metric;
  unitKey: string | null; name: string; selected: string | null;
  onSelect: (u: UnitScope | null) => void; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const isActive = unitKey != null && selected === unitKey;
  const pick = () => { if (unitKey) onSelect({ unitKey, name }); };
  return (
    <div className="org-node">
      <div className={`org-row selectable${isActive ? ' active' : ''}`} onClick={pick}>
        <span className={`org-twist${open ? ' open' : ''}`} onClick={e => { e.stopPropagation(); setOpen(o => !o); }}>▶</span>
        <span className={`org-name ${cls}`}>{label}</span>
        <span className="org-kind-slot">{tag ? <span className="org-kind">{tag}</span> : null}</span>
        <Bar value={value} max={max} metric={metric} />
      </div>
      <div className={`org-children${open ? ' open' : ''}`}>{children}</div>
    </div>
  );
}

export function TenantOrgTree({ slug, selected, onSelect }: {
  slug: string; selected: UnitScope | null; onSelect: (u: UnitScope | null) => void;
}) {
  const [data, setData] = useState<OrgTree | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>('papers');

  useEffect(() => {
    fetch(`/api/public/${encodeURIComponent(slug)}/org-tree`)
      .then(async r => {
        if (!r.ok) throw new Error(`Org tree failed (${r.status})`);
        return r.json() as Promise<OrgTree>;
      })
      .then(setData)
      .catch(e => setError(e.message));
  }, [slug]);

  const ranked = useMemo(() => (data ? rank(data.faculties, metric) : []), [data, metric]);
  const facMax = ranked.length ? valueOf(ranked[0], metric) : 0;
  const selKey = selected?.unitKey ?? null;

  if (error) return <div className="org-err" style={{ padding: 14 }}>{error}</div>;
  if (!data) return <div style={{ padding: 14, color: 'var(--fg-dim)', fontFamily: 'var(--mono)', fontSize: 13 }}>{ES.loadingLabel(ES.orgSchemeLoading)}</div>;
  if (!data.faculties.length) return <div className="text-muted text-small" style={{ padding: 14 }}>{ES.orgTree.noRoster}</div>;

  return (
    <>
      <div className="org-metric-toggle" style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {METRICS.map(m => (
          <button key={m.id} type="button" onClick={() => setMetric(m.id)}
            style={{ padding: '4px 9px', borderRadius: 6, cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 11,
              border: '1px solid var(--border)',
              background: metric === m.id ? 'var(--primary)' : 'transparent',
              color: metric === m.id ? 'var(--bg)' : 'var(--fg-dim)' }}>
            {m.label}
          </button>
        ))}
      </div>
      <div className="org-tree">
        {/* Scope reset — selected when no unit is active. */}
        <div className="org-node">
          <div className={`org-row selectable all-units${selKey === null ? ' active' : ''}`} onClick={() => onSelect(null)}>
            <span className="org-twist" />
            <span className="org-name fac">{ES.orgTree.allOrganization}</span>
            <span className="org-kind-slot" />
            <Bar value={data.totals.papers} max={data.totals.papers} metric={metric} />
          </div>
        </div>
        {ranked.map(f => {
          const depts = rank(f.departments, metric);
          const depMax = depts.length ? valueOf(depts[0], metric) : 0;
          return (
            <Branch key={f.name}
              label={f.name} tag={KIND_LABEL[f.kind]}
              cls="fac" value={valueOf(f, metric)} max={facMax} metric={metric}
              unitKey={f.unitKey} name={f.name} selected={selKey} onSelect={onSelect}>
              {depts.map(d => (
                <Branch key={d.name} label={d.name} cls="dep"
                  value={valueOf(d, metric)} max={depMax} metric={metric}
                  unitKey={d.unitKey} name={`${f.name} · ${d.name}`} selected={selKey} onSelect={onSelect}>
                  {d.people.map((p, i) => <PersonRow key={`${p.orcid || p.name}-${i}`} p={p} />)}
                </Branch>
              ))}
            </Branch>
          );
        })}
      </div>
      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--fg-dim)', fontFamily: 'var(--mono)' }}>
        {ES.contributors.footnote}
      </div>
    </>
  );
}
