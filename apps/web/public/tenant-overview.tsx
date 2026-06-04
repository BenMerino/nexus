import React, { useEffect, useState } from 'react';
import type { GraphDirective } from '../architect/graph-composer.types';
import { SummaryCards } from './tenant-summary';
import { TenantChartsTab } from './tenant-charts-tab';
import { TenantContributors } from './tenant-contributors';
import type { UnitScope } from './tenant-org-tree';
import type { PublicStats } from './tenant-builders';
import { ES } from './tenant-i18n';

/* The Overview content (KPIs + charts). Scope is owned by the org rail (the
 * picker); this just renders it. Philosophy #1 — "scope is sovereign": when a
 * unit is selected in the rail the whole dashboard re-narrows in place (the way
 * personal scope narrows by ORCID). Time-series charts (cadence/indexation/
 * velocity) are not yet unit-scoped on the server, so when a unit is active we
 * say so rather than show university-wide data under a unit heading. */

// Fetch the unit-scoped summary KPIs; null unit → the tenant-wide summary in
// `stats` (no extra request).
function useScopedSummary(slug: string, unit: UnitScope | null, tenantSummary: PublicStats['summary']) {
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

export function TenantOverview({ slug, stats, tenantId, charts, unit }: {
  slug: string; stats: PublicStats; tenantId: number; charts: GraphDirective[]; unit: UnitScope | null;
}) {
  const summary = useScopedSummary(slug, unit, stats.summary);
  const unitKey = unit?.unitKey ?? null;

  return (
    <>
      {unitKey ? (
        <div style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--fg-dim)', fontFamily: 'var(--mono)' }}>
          {ES.unitPicker.scopedNote(unit!.name)}
        </div>
      ) : null}
      <SummaryCards summary={summary} />
      {/* Biggest-contributors ranking — a whole-university comparison; shown only
          at "All organization" scope (meaningless narrowed to one unit). */}
      {unitKey ? null : <TenantContributors slug={slug} />}
      <TenantChartsTab stats={stats} tenantId={tenantId} charts={charts} unit={unitKey} />
    </>
  );
}
