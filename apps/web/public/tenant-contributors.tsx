import React, { useEffect, useMemo, useState } from 'react';
import { ES } from './tenant-i18n';
import { type Metric, type Unit, METRICS, valueOf, fmt, rank, Bar } from './tenant-org-row';

/* Biggest contributors — the whole-university comparison, shown on the right at
 * "All organization" scope (hidden once a single unit is picked). Ranks
 * faculties as peers; click a bar → ranks ITS departments (never parent-vs-child
 * on one axis). One metric at a time via the toggle (Publications / Per academic
 * / Citations). Reads the org-tree payload — same numbers as the rail. */

interface Department extends Unit { departments?: undefined; }
interface Faculty extends Unit { departments: Department[]; }
interface OrgTree { faculties: Faculty[]; }

function Rows({ units, metric, onDrill }: { units: Unit[]; metric: Metric; onDrill?: (u: Faculty) => void }) {
  const ranked = useMemo(() => rank(units, metric).filter(u => valueOf(u, metric) > 0), [units, metric]);
  const max = ranked.length ? valueOf(ranked[0], metric) : 0;
  if (!ranked.length) return <div style={{ padding: 14, color: 'var(--fg-dim)', fontFamily: 'var(--mono)', fontSize: 13 }}>{ES.contributors.noData}</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {ranked.map(u => {
        const fac = u as Faculty;
        const drillable = !!(onDrill && fac.departments && fac.departments.length);
        return (
          <div key={u.name} className={`contrib-row${drillable ? ' drillable' : ''}`}
            onClick={drillable ? () => onDrill!(fac) : undefined}
            title={drillable ? ES.contributors.drillHint : undefined}>
            <span className="contrib-name">{drillable ? '▸ ' : ''}{u.name}</span>
            <Bar value={valueOf(u, metric)} max={max} metric={metric} />
          </div>
        );
      })}
    </div>
  );
}

export function TenantContributors({ slug }: { slug: string }) {
  const [tree, setTree] = useState<OrgTree | null>(null);
  const [metric, setMetric] = useState<Metric>('papers');
  const [drill, setDrill] = useState<Faculty | null>(null);

  useEffect(() => {
    fetch(`/api/public/${encodeURIComponent(slug)}/org-tree`)
      .then(r => (r.ok ? r.json() as Promise<OrgTree> : Promise.reject(r.status)))
      .then(setTree)
      .catch(() => setTree(null));
  }, [slug]);

  if (!tree || !tree.faculties.length) return null;

  const units: Unit[] = drill ? (drill.departments ?? []) : tree.faculties;
  // Bare: rendered INSIDE a ChartPanel (which owns the title/frame), so this is
  // just the metric toggle + ranked rows + drill — no card/title of its own.
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4, marginBottom: 14, flexWrap: 'wrap' }}>
        {drill ? (
          <span style={{ marginRight: 'auto', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--fg-muted)' }}>{ES.contributors.titleIn(drill.name)}</span>
        ) : null}
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
      {drill ? (
        <button type="button" onClick={() => setDrill(null)}
          style={{ marginBottom: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontFamily: 'var(--mono)', fontSize: 12, padding: 0 }}>
          {ES.contributors.backToFaculties}
        </button>
      ) : null}
      <Rows units={units} metric={metric} onDrill={drill ? undefined : setDrill} />
      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--fg-dim)', fontFamily: 'var(--mono)' }}>
        {ES.contributors.footnote}
      </div>
    </div>
  );
}
