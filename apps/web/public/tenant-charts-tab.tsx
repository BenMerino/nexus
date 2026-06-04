import React from 'react';
import type { GraphDirective } from '../architect/graph-composer.types';
import { DirectiveChart } from '../ui/graph-engine/index';
import { BatchedCharts } from './recompose-chart';
import { VelocityPanel } from './portfolio-velocity';
import { CadencePanel } from './portfolio-cadence';
import { hasYearIndex } from './tenant-year-chart';
import type { PublicStats } from './tenant-builders';
import { ChartPanel } from './tenant-panel';
import { ES, typeLabelEs, VELOCITY_LABELS_ES, CADENCE_LABELS_ES } from './tenant-i18n';

/* The chart grid (mockup): contributors hero tall-left, velocity + cadence
 * stacked right, publications-per-year full-width below, then the categorical
 * kinds (journals / collaborators / countries) each in their own panel. Charts
 * stay SERVER-COMPOSED (N8) — only the .panel frame is the design's. When a
 * unit is selected only the unit-aware server kinds render (the velocity/
 * cadence/byIndex kinds aren't unit-scoped yet). */

// The full-width "Publications per year" body: the server byIndex/typeByYear
// kinds when an index exists, else the client no-index fallback directive.
function YearPanel({ stats, tenantId, charts, unit }: { stats: PublicStats; tenantId: number; charts: GraphDirective[]; unit?: string | null }) {
  return (
    <ChartPanel className="full" title={ES.charts.pubsByYear} sub={ES.charts.byIndexSource}>
      {hasYearIndex(stats)
        ? <BatchedCharts kinds={['publications.byIndex']} tenantId={tenantId} unit={unit} bare />
        : charts.map((c, i) => <DirectiveChart key={c.persistKey ?? i} seed={c} />)}
    </ChartPanel>
  );
}

export function TenantChartsTab({ stats, tenantId, charts, unit, contributors }: {
  stats: PublicStats; tenantId: number; charts: GraphDirective[]; unit?: string | null;
  contributors?: React.ReactNode;
}) {
  const scoped = !!unit;
  // Categorical kinds, each wrapped in its own panel below the hero grid.
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
        {scoped ? null : (
          <>
            {stats.velocity ? (
              <ChartPanel title={ES.charts.citationVelocity} sub={ES.charts.citationsPerYear}>
                <VelocityPanel velocity={stats.velocity} labels={VELOCITY_LABELS_ES} />
              </ChartPanel>
            ) : null}
            {stats.cadence ? (
              <ChartPanel title={ES.charts.publicationCadence} sub={ES.charts.byDocType} tag="stacked · year">
                <CadencePanel cadence={stats.cadence} tenantId={tenantId} labels={CADENCE_LABELS_ES} typeLabel={typeLabelEs} />
              </ChartPanel>
            ) : null}
            <YearPanel stats={stats} tenantId={tenantId} charts={charts} unit={unit} />
          </>
        )}
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
