import React from 'react';
import type { GraphDirective } from '../architect/graph-composer.types';
import type { PublicStats } from './tenant-builders';
import type { UnitScope } from './tenant-scope-rail';
import { GraphProviders } from '../ui/graph-engine-providers';
import { TenantOverview } from './tenant-overview';

/* The engine-bearing half of the tenant page, split behind React.lazy: this
 * module's import chain pulls the vendored graph engine (the ~380KB chunk).
 * Keeping it out of tenant.tsx's static graph lets the shell (header, KPI
 * cards, scope rail) parse + paint from the small page chunk; the chart grid
 * hydrates when this chunk and the chart data arrive — which it was already
 * waiting on. Default export so `React.lazy(() => import('./tenant-body'))`
 * resolves directly. */
export default function TenantBody({ slug, stats, tenantId, charts, unit }: {
  slug: string; stats: PublicStats; tenantId: number; charts: GraphDirective[]; unit: UnitScope | null;
}) {
  return (
    // GraphProviders wires the engine's EngineConfig (apiGet/dark/pref) +
    // ChartTuning (glow 0) so the vendored charts get the slider span fetch,
    // theme, and persisted toggles. tenantId scopes the per-tenant tuning.
    <GraphProviders tenantId={String(tenantId)}>
      <TenantOverview slug={slug} stats={stats} tenantId={tenantId} charts={charts} unit={unit} />
    </GraphProviders>
  );
}
