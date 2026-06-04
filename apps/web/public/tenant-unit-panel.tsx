import React, { useEffect, useState } from 'react';
import { SummaryCards } from './tenant-summary';
import { BatchedCharts } from './recompose-chart';
import type { PublicStats } from './tenant-builders';
import { ES } from './tenant-i18n';

/* Per-org-unit dashboard — the drill-down target from the Org-Tree tab. Reuses
 * the tenant Overview building blocks (SummaryCards + server-composed charts)
 * but scoped to ONE faculty/department via its `unitKey`. KPIs come from the
 * public stats endpoint with ?unit=; charts from the recompose batch with the
 * unit forwarded. Only the kinds that are genuinely unit-scoped on the server
 * are shown — we never render a tenant-wide chart under a unit header. */

export interface UnitSelection {
  unitKey: string;
  name: string;
  kind: 'faculty' | 'institute' | 'other';
}
interface Person { name: string; category: string | null; orcid: string | null; paperCount: number; }

// Categorical kinds the server narrows by unit today (topJournals/collaborators/
// countries via resolvePubFilter). Time-series kinds (velocity/cadence/byIndex/
// typeByYear) are not yet unit-aware, so they're intentionally omitted rather
// than shown with tenant-wide data under a unit header.
const UNIT_CHART_KINDS = [
  'publications.topJournals',
  'publications.collaborators',
  'publications.countries',
];

function useUnitSummary(slug: string, unitKey: string) {
  const [summary, setSummary] = useState<PublicStats['summary'] | null>(null);
  useEffect(() => {
    let cancelled = false;
    setSummary(null);
    fetch(`/api/public/${encodeURIComponent(slug)}/stats?chrome=1&unit=${encodeURIComponent(unitKey)}`)
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: { stats: PublicStats }) => { if (!cancelled) setSummary(d.stats.summary); })
      .catch(() => { if (!cancelled) setSummary(null); });
    return () => { cancelled = true; };
  }, [slug, unitKey]);
  return summary;
}

function UnitAuthors({ people }: { people: Person[] }) {
  if (!people.length) return null;
  const sorted = [...people].sort((a, b) => b.paperCount - a.paperCount);
  return (
    <section className="card" style={{ padding: 18, marginTop: 16 }}>
      <h3 style={{ fontFamily: 'var(--display)', fontWeight: 400, fontSize: 16, margin: '0 0 12px' }}>
        {ES.orgTree.unitAuthors} ({people.length})
      </h3>
      <div className="org-tree">
        {sorted.map((p, i) => (
          <div key={`${p.orcid || p.name}-${i}`} className="org-row leaf">
            <span className="org-name person">{p.name} <span className="text-muted">· {p.category || ''}</span></span>
            <span className="org-metrics">
              {p.orcid
                ? <a className="org-orcid" href={`https://orcid.org/${p.orcid}`} target="_blank" rel="noopener noreferrer">{p.orcid}</a>
                : <span className="org-orcid none">{ES.orgTree.orcidNone}</span>}
              <span className="org-pill">{p.paperCount} {p.paperCount === 1 ? ES.orgTree.paperOne : ES.orgTree.paperMany}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function TenantUnitPanel({ slug, tenantId, unit, people, onBack }: {
  slug: string; tenantId: number; unit: UnitSelection; people: Person[]; onBack: () => void;
}) {
  const summary = useUnitSummary(slug, unit.unitKey);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '0 0 16px', flexWrap: 'wrap' }}>
        <button type="button" onClick={onBack} className="org-back-btn"
          style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', color: 'var(--fg)', fontFamily: 'var(--mono)', fontSize: 12 }}>
          {ES.orgTree.backToTree}
        </button>
        <h2 style={{ fontFamily: 'var(--display)', fontWeight: 400, fontSize: 20, margin: 0 }}>
          {ES.orgTree.unitAnalyticsFor(unit.name)}
        </h2>
      </div>
      {summary ? <SummaryCards summary={summary} /> : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 16 }}>
        <BatchedCharts kinds={UNIT_CHART_KINDS} tenantId={tenantId} unit={unit.unitKey} />
      </div>
      <UnitAuthors people={people} />
    </div>
  );
}
