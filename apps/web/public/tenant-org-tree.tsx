import React, { useEffect, useMemo, useState } from 'react';
import { ES } from './tenant-i18n';

/* The org scheme IS the contributors ranking. Each faculty/department row
 * carries an inline bar for the selected metric and is sorted by it (biggest
 * first); expand to drill into departments → people. One component, no separate
 * chart. Metric toggle at the top switches Publications / Per academic /
 * Citations. Reads the org-tree payload (papers + citations + headcount). */

interface Person { name: string; category: string | null; orcid: string | null; paperCount: number; }
interface Unit { name: string; headcount: number; withOrcid: number; papers: number; citations: number; }
interface Department extends Unit { people: Person[]; }
interface Faculty extends Unit { kind: 'faculty' | 'institute' | 'other'; departments: Department[]; }
interface OrgTree {
  totals: { headcount: number; withOrcid: number; papers: number; citations: number; faculties: number; institutes: number; units: number; };
  faculties: Faculty[];
}

const KIND_LABEL = ES.orgTree.kindLabel;

type Metric = 'papers' | 'perCapita' | 'citations';
const METRICS: { id: Metric; label: string }[] = [
  { id: 'papers', label: ES.contributors.volume },
  { id: 'perCapita', label: ES.contributors.perCapita },
  { id: 'citations', label: ES.contributors.citations },
];
const valueOf = (u: Unit, m: Metric): number =>
  m === 'papers' ? u.papers
  : m === 'citations' ? u.citations
  : u.headcount > 0 ? u.papers / u.headcount : 0;
const fmt = (v: number, m: Metric) =>
  m === 'perCapita' ? v.toFixed(1) : Math.round(v).toLocaleString();
// Rank a set of units by the metric, largest first (stable name tiebreak).
function rank<T extends Unit>(units: T[], m: Metric): T[] {
  return [...units].sort((a, b) => valueOf(b, m) - valueOf(a, m) || a.name.localeCompare(b.name));
}

function Bar({ value, max, metric }: { value: number; max: number; metric: Metric }) {
  return (
    <span className="org-bar" title={`${fmt(value, metric)}`}>
      <span className="org-bar-track">
        <span className="org-bar-fill" style={{ width: `${max > 0 ? Math.max(2, (value / max) * 100) : 0}%` }} />
      </span>
      <span className="org-bar-val">{fmt(value, metric)}</span>
    </span>
  );
}

function PersonRow({ p }: { p: Person }) {
  return (
    <div className="org-node">
      <div className="org-row leaf">
        <span className="org-twist" />
        <span className="org-name person">{p.name} <span className="text-muted">· {p.category || ''}</span></span>
        <span className="org-metrics">
          {p.orcid
            ? <a className="org-orcid" href={`https://orcid.org/${p.orcid}`} target="_blank" rel="noopener noreferrer">{p.orcid}</a>
            : <span className="org-orcid none">{ES.orgTree.orcidNone}</span>}
          <span className="org-pill">{p.paperCount} {p.paperCount === 1 ? ES.orgTree.paperOne : ES.orgTree.paperMany}</span>
        </span>
      </div>
    </div>
  );
}

function Branch({ label, cls, value, max, metric, children }: {
  label: React.ReactNode; cls: string; value: number; max: number; metric: Metric; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="org-node">
      <div className="org-row" onClick={() => setOpen(o => !o)}>
        <span className={`org-twist${open ? ' open' : ''}`}>▶</span>
        <span className={`org-name ${cls}`}>{label}</span>
        <Bar value={value} max={max} metric={metric} />
      </div>
      <div className={`org-children${open ? ' open' : ''}`}>{children}</div>
    </div>
  );
}

export function TenantOrgTree({ slug }: { slug: string }) {
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

  // Faculties ranked by the metric; max faculty value scales the top-level bars.
  const ranked = useMemo(() => (data ? rank(data.faculties, metric) : []), [data, metric]);
  const facMax = ranked.length ? valueOf(ranked[0], metric) : 0;

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
        {ranked.map(f => {
          // Departments ranked within the faculty; scaled to the faculty's own
          // top department so each faculty's internal ranking reads clearly.
          const depts = rank(f.departments, metric);
          const depMax = depts.length ? valueOf(depts[0], metric) : 0;
          return (
            <Branch key={f.name}
              label={<>{f.name}{KIND_LABEL[f.kind] ? <span className="org-kind"> {KIND_LABEL[f.kind]}</span> : null}</>}
              cls="fac" value={valueOf(f, metric)} max={facMax} metric={metric}>
              {depts.map(d => (
                <Branch key={d.name} label={d.name} cls="dep"
                  value={valueOf(d, metric)} max={depMax} metric={metric}>
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
