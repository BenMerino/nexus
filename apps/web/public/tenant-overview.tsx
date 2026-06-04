import React from 'react';
import type { GraphDirective } from '../architect/graph-composer.types';
import { TenantChartsTab } from './tenant-charts-tab';
import { TenantContributors } from './tenant-contributors';
import { AuthorsTable } from './tenant-authors';
import type { UnitScope } from './tenant-scope-rail';
import type { PublicStats } from './tenant-builders';
import { ES } from './tenant-i18n';

/* The Overview content (the chart grid + author directory). KPIs render above
 * the rail in tenant.tsx; this is everything to the RIGHT of the scope rail.
 * Scope is owned by the rail (the picker); selecting a unit re-narrows the
 * whole grid in place (Philosophy #1 — "scope is sovereign"). Time-series
 * charts (cadence/indexation/velocity) are not yet unit-scoped on the server,
 * so they are hidden when a unit is active (TenantChartsTab). */

export function TenantOverview({ slug, stats, tenantId, charts, unit }: {
  slug: string; stats: PublicStats; tenantId: number; charts: GraphDirective[]; unit: UnitScope | null;
}) {
  const unitKey = unit?.unitKey ?? null;

  return (
    <>
      {/* Chart grid: contributors hero (left, tall) + velocity/cadence/byIndex
          panels. The contributors ranking is a whole-university comparison —
          shown only at "All units" scope (meaningless narrowed to one unit). */}
      <TenantChartsTab stats={stats} tenantId={tenantId} charts={charts} unit={unitKey}
        contributors={unitKey ? null : <TenantContributors slug={slug} />} />
      {/* Author directory, scoped to the selected unit (all authors at the
          university/main scope; a faculty's roster when a unit is selected). */}
      <section style={{ marginTop: 24 }}>
        <h3 className="panel-title" style={{ marginBottom: 12 }}>{ES.nav.authors}</h3>
        <AuthorsTable slug={slug} unit={unitKey} />
      </section>
    </>
  );
}
