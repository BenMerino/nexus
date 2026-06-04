import React, { useEffect, useMemo, useState } from 'react';
import { ES } from './tenant-i18n';

/* Biggest contributors — a whole-university comparison the tenant totals and the
 * unit picker can't show: who carries the output. Ranks faculties as peers;
 * click one → ranks ITS departments (never parent-vs-child on one axis, which
 * would double-count a faculty against its own children). One metric at a time
 * (Volume / Per-capita / Citations) via a toggle — same data, high signal/noise.
 * Reads the org-tree payload (same numbers as the Org-Tree tab; citations added
 * server-side), so nothing here re-queries or can drift from the tree. */

interface Unit { name: string; headcount: number; papers: number; citations: number; departments?: Unit[]; }
interface OrgTree { faculties: Unit[]; }

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

function Bars({ units, metric, onDrill }: { units: Unit[]; metric: Metric; onDrill?: (u: Unit) => void }) {
  const ranked = useMemo(
    () => [...units].map(u => ({ u, v: valueOf(u, metric) }))
      .sort((a, b) => b.v - a.v)
      .filter(x => x.v > 0),
    [units, metric],
  );
  const max = ranked.length ? ranked[0].v : 1;
  if (!ranked.length) return <div style={{ padding: 14, color: 'var(--fg-dim)', fontFamily: 'var(--mono)', fontSize: 13 }}>{ES.contributors.noData}</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {ranked.map(({ u, v }) => {
        const drillable = !!(onDrill && u.departments && u.departments.length);
        return (
          <div key={u.name} onClick={drillable ? () => onDrill!(u) : undefined}
            style={{ cursor: drillable ? 'pointer' : 'default' }} title={drillable ? ES.contributors.drillHint : undefined}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontFamily: 'var(--mono)', marginBottom: 3 }}>
              <span style={{ color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '78%' }}>
                {drillable ? '▸ ' : ''}{u.name}
              </span>
              <span style={{ color: 'var(--fg-dim)' }}>{fmt(v, metric)}</span>
            </div>
            <div style={{ height: 8, background: 'var(--bg-inset, var(--border-soft))', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.max(2, (v / max) * 100)}%`, background: 'var(--primary)', borderRadius: 4 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TenantContributors({ slug }: { slug: string }) {
  const [tree, setTree] = useState<OrgTree | null>(null);
  const [metric, setMetric] = useState<Metric>('papers');
  const [drill, setDrill] = useState<Unit | null>(null);

  useEffect(() => {
    fetch(`/api/public/${encodeURIComponent(slug)}/org-tree`)
      .then(r => (r.ok ? r.json() as Promise<OrgTree> : Promise.reject(r.status)))
      .then(setTree)
      .catch(() => setTree(null));
  }, [slug]);

  if (!tree || !tree.faculties.length) return null; // no roster → no chart

  const units = drill ? (drill.departments ?? []) : tree.faculties;
  return (
    <section className="card" style={{ padding: 18, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <h3 style={{ fontFamily: 'var(--display)', fontWeight: 400, fontSize: 16, margin: 0 }}>
          {drill ? ES.contributors.titleIn(drill.name) : ES.contributors.title}
        </h3>
        <div style={{ display: 'flex', gap: 4 }}>
          {METRICS.map(m => (
            <button key={m.id} type="button" onClick={() => setMetric(m.id)}
              style={{ padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 11,
                border: '1px solid var(--border)',
                background: metric === m.id ? 'var(--primary)' : 'transparent',
                color: metric === m.id ? 'var(--bg)' : 'var(--fg-dim)' }}>
              {m.label}
            </button>
          ))}
        </div>
      </div>
      {drill ? (
        <button type="button" onClick={() => setDrill(null)}
          style={{ marginBottom: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontFamily: 'var(--mono)', fontSize: 12, padding: 0 }}>
          {ES.contributors.backToFaculties}
        </button>
      ) : null}
      <Bars units={units} metric={metric} onDrill={drill ? undefined : setDrill} />
      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--fg-dim)', fontFamily: 'var(--mono)' }}>
        {ES.contributors.footnote}
      </div>
    </section>
  );
}
