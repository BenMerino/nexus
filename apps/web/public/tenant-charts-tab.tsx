import React from 'react';
import type { GraphDirective } from '../architect/graph-composer.types';
import { DirectiveChart } from '../ui/graph-engine/index';
import { BatchedCharts } from './recompose-chart';
import { VelocityPanel } from './portfolio-velocity';
import { CadencePanel } from './portfolio-cadence';
import { hasYearIndex } from './tenant-year-chart';
import type { PublicStats } from './tenant-builders';
import { ChartPanel } from './tenant-panel';
import { useScopedAnalytics } from './use-scoped-analytics';
import { ES, typeLabelEs, VELOCITY_LABELS_ES, CADENCE_LABELS_ES } from './tenant-i18n';

/* The chart grid (mockup): contributors hero tall-left, velocity + cadence
 * stacked right, publications-per-year full-width below, then the categorical
 * kinds (journals / collaborators / countries) each in their own panel. All
 * charts stay SERVER-COMPOSED (N8) — only the .panel frame is the design's. The
 * server now unit-scopes every kind, so selecting a faculty re-narrows the whole
 * grid in place (velocity/cadence re-fetch via useScopedAnalytics; byIndex +
 * categorical kinds carry ?unit= through recompose). */

// The full-width "Publications per year" body: the server byIndex kind when an
// index exists (unit-scoped), else the client no-index fallback directive.
function YearPanel({ stats, tenantId, charts, unit }: { stats: PublicStats; tenantId: number; charts: GraphDirective[]; unit?: string | null }) {
  return (
    <ChartPanel className="full" title={ES.charts.pubsByYear} sub={ES.charts.byIndexSource}>
      {hasYearIndex(stats)
        ? <BatchedCharts kinds={['publications.byIndex']} tenantId={tenantId} unit={unit} bare />
        : charts.map((c, i) => <DirectiveChart key={c.persistKey ?? i} seed={c} />)}
    </ChartPanel>
  );
}

export function TenantChartsTab({ slug, stats, tenantId, charts, unit, contributors }: {
  slug: string; stats: PublicStats; tenantId: number; charts: GraphDirective[]; unit?: string | null;
  contributors?: React.ReactNode;
}) {
  // Velocity + cadence re-narrow to the selected unit (tenant-wide at null).
  const { velocity, cadence } = useScopedAnalytics(slug, unit ?? null, stats);
  const catKinds = ['publications.topJournals', 'publications.collaborators', 'publications.countriesMap'];
  const catTitles: Record<string, string> = {
    'publications.topJournals': ES.charts.topJournals,
    'publications.collaborators': ES.charts.topInstitutions,
    'publications.countriesMap': ES.charts.pubsByCountry,
  };

  return (
    <>
      <div className="chart-grid">
        {/* Contributors hero — spans two rows on the left (whole-university
            comparison; hidden when a single unit is the scope). */}
        {contributors ? (
          <ChartPanel className="tall" title={ES.contributors.title} sub={ES.contributors.volume} tag="by unit">
            {contributors}
          </ChartPanel>
        ) : null}
        {velocity ? (
          <ChartPanel title={ES.charts.citationVelocity} sub={ES.charts.citationsPerYear}>
            <VelocityPanel velocity={velocity} labels={VELOCITY_LABELS_ES} />
          </ChartPanel>
        ) : null}
        {cadence ? (
          <ChartPanel title={ES.charts.publicationCadence} sub={ES.charts.byDocType} tag="stacked · year">
            <CadencePanel cadence={cadence} tenantId={tenantId} labels={CADENCE_LABELS_ES} typeLabel={typeLabelEs} />
          </ChartPanel>
        ) : null}
        <YearPanel stats={stats} tenantId={tenantId} charts={charts} unit={unit} />
      </div>
      {/* Categorical kinds in ONE batch round-trip, each framed in its own
          panel via `wrap` (journals/collaborators half-width, the map full). */}
      <div className="chart-grid" style={{ marginTop: 24 }}>
        <BatchedCharts kinds={catKinds} tenantId={tenantId} unit={unit}
          wrap={(kind, body) => (
            <ChartPanel className={kind === 'publications.countriesMap' ? 'full' : ''} title={catTitles[kind]}>
              {body}
            </ChartPanel>
          )} />
      </div>
    </>
  );
}
