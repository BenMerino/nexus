import React from 'react';
import type { GraphDirective } from '../architect/graph-composer.types';
import type { PublicStats } from './tenant-builders';
import type { UnitScope } from './tenant-unit-scope-type';
import { GraphProviders } from '../ui/graph-engine-providers';
import { SectionView } from './tenant-section-views';

/* The engine-bearing half of the tenant page, split behind React.lazy: this
 * module's import chain pulls the vendored graph engine (the ~380KB chunk).
 * Keeping it out of tenant.tsx's static graph lets the shell (header, KPI
 * cards, sidebar) parse + paint from the small page chunk; the chart grid
 * hydrates when this chunk and the chart data arrive — which it was already
 * waiting on. Default export so `React.lazy(() => import('./tenant-body'))`
 * resolves directly. Renders the content of the active IA section. */
export default function TenantBody({ slug, stats, tenantId, charts, unit, section }: {
  slug: string; stats: PublicStats; tenantId: number; charts: GraphDirective[];
  unit: UnitScope | null; section: string;
}) {
  return (
    // GraphProviders wires the engine's EngineConfig (apiGet/dark/pref) +
    // ChartTuning (glow 0) so the vendored charts get the slider span fetch,
    // theme, and persisted toggles. tenantId scopes the per-tenant tuning.
    <GraphProviders tenantId={String(tenantId)}>
      <SectionView section={section} slug={slug} stats={stats} tenantId={tenantId} charts={charts} unit={unit} />
    </GraphProviders>
  );
}
