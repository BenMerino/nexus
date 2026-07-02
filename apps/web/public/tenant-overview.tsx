import React from 'react';
import type { GraphDirective } from '../architect/graph-composer.types';
import { TenantChartsTab } from './tenant-charts-tab';
import { TenantContributors } from './tenant-contributors';
import { TenantWorks } from './tenant-works';
import { AuthorsTable } from './tenant-authors';
import type { UnitScope } from './tenant-scope-rail';
import type { PublicStats } from './tenant-builders';
import { ES } from './tenant-i18n';
import { PhaseSequence, Phase } from './phase-mount';

/* The Overview content (chart grid + publication lists + author directory).
 * KPIs render above the rail in tenant.tsx; this is everything to the RIGHT
 * of the scope rail. Scope is owned by the rail (the picker); selecting a
 * unit re-narrows charts, works and the directory in place (Philosophy #1 —
 * "scope is sovereign"). */

export function TenantOverview({ slug, stats, tenantId, charts, unit }: {
  slug: string; stats: PublicStats; tenantId: number; charts: GraphDirective[]; unit: UnitScope | null;
}) {
  const unitKey = unit?.unitKey ?? null;

  return (
    // Phased mount: the three overview sections lay out in sequence as REAL,
    // complete elements — chart grid, then works, then the author directory —
    // one beat apart. The sequence runs to completion even when data is already
    // present; the choreography is the sequential appearance, not a hide-hack.
    <PhaseSequence phases={3}>
      {/* Chart grid: contributors hero (left, tall) + velocity/research-areas
          panels + the merged year panel. The contributors ranking is a whole-
          university comparison — shown only at "All units" scope. */}
      <Phase index={0}>
        <TenantChartsTab stats={stats} tenantId={tenantId} charts={charts} unit={unitKey}
          contributors={unitKey ? null : <TenantContributors slug={slug} />} />
      </Phase>
      {/* Most-cited + recent publications, unit-scoped like the charts. */}
      <Phase index={1}>
        <TenantWorks slug={slug} unit={unitKey} />
      </Phase>
      {/* Author directory, scoped to the selected unit (all authors at the
          university/main scope; a faculty's roster when a unit is selected). */}
      <Phase index={2}>
        <section style={{ marginTop: 24 }}>
          <h3 className="panel-title" style={{ marginBottom: 12 }}>{ES.nav.authors}</h3>
          <AuthorsTable slug={slug} unit={unitKey} />
        </section>
      </Phase>
    </PhaseSequence>
  );
}
