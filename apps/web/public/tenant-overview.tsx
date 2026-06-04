import React, { useEffect, useState } from 'react';
import type { GraphDirective } from '../architect/graph-composer.types';
import { SummaryCards } from './tenant-summary';
import { TenantChartsTab } from './tenant-charts-tab';
import { UnitPicker, type UnitOption } from './tenant-unit-picker';
import type { PublicStats } from './tenant-builders';
import { ES } from './tenant-i18n';

/* The Overview tab. Philosophy #1 — "scope is sovereign": a unit picker at the
 * top re-narrows the WHOLE dashboard in place (the way personal scope narrows by
 * ORCID). Default = whole university. Pick a faculty/department → KPI cards +
 * the unit-aware charts re-scope via ?unit=/recompose unit=. Time-series charts
 * (cadence/indexation/velocity) are not yet unit-scoped on the server, so when a
 * unit is active we honestly say so rather than show university-wide data under a
 * unit heading. */

// Fetch the unit-scoped summary KPIs; null unit → use the tenant-wide summary
// already in `stats` (no extra request).
function useScopedSummary(slug: string, unit: UnitOption | null, tenantSummary: PublicStats['summary']) {
  const [summary, setSummary] = useState<PublicStats['summary']>(tenantSummary);
  useEffect(() => {
    if (!unit?.unitKey) { setSummary(tenantSummary); return; }
    let cancelled = false;
    setSummary({ totalPubs: 0, totalCitations: 0, oaCount: 0, authorCount: 0 });
    fetch(`/api/public/${encodeURIComponent(slug)}/stats?chrome=1&unit=${encodeURIComponent(unit.unitKey)}`)
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: { stats: PublicStats }) => { if (!cancelled) setSummary(d.stats.summary); })
      .catch(() => { if (!cancelled) setSummary(tenantSummary); });
    return () => { cancelled = true; };
  }, [slug, unit?.unitKey, tenantSummary]);
  return summary;
}

export function TenantOverview({ slug, stats, tenantId, charts }: {
  slug: string; stats: PublicStats; tenantId: number; charts: GraphDirective[];
}) {
  const [unit, setUnit] = useState<UnitOption | null>(null);
  const summary = useScopedSummary(slug, unit, stats.summary);
  const unitKey = unit?.unitKey ?? null;

  return (
    <>
      <UnitPicker slug={slug} value={unit} onChange={setUnit} />
      {unitKey ? (
        <div style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--fg-dim)', fontFamily: 'var(--mono)' }}>
          {ES.unitPicker.scopedNote(unit!.name)}
        </div>
      ) : null}
      <SummaryCards summary={summary} />
      <TenantChartsTab stats={stats} tenantId={tenantId} charts={charts} unit={unitKey} />
    </>
  );
}
