import React from 'react';
import type { GraphDirective } from '../architect/graph-composer.types';
import { DirectiveChart } from '../ui/graph-engine/index';
import { BatchedCharts } from './recompose-chart';
import { CadencePanel } from './portfolio-cadence';
import { hasYearIndex } from './tenant-year-chart';
import type { PublicStats } from './tenant-builders';
import { ChartPanel } from './tenant-panel';
import { useScopedAnalytics } from './use-scoped-analytics';
import { ES, typeLabelEs, CADENCE_LABELS_ES } from './tenant-i18n';

/* The chart grid (mockup): contributors hero tall-left, velocity + cadence
 * stacked right, publications-per-year full-width below, then the categorical
 * kinds (journals / collaborators / countries) each in their own panel. All
 * charts stay SERVER-COMPOSED (N8) — only the .panel frame is the design's. The
 * server now unit-scopes every kind, so selecting a faculty re-narrows the whole
 * grid in place (cadence re-fetches via useScopedAnalytics; velocity, byIndex +
 * categorical kinds carry ?unit= through recompose). */

// The full-width "Publications per year" body: the server byIndex kind when an
// index exists (unit-scoped), else the client no-index fallback directive.
function YearPanel({ stats, tenantId, charts, unit }: { stats: PublicStats; tenantId: number; charts: GraphDirective[]; unit?: string | null }) {
  return (
    <ChartPanel className="full" title={ES.charts.pubsByYear} sub={ES.charts.byIndexSource}>
      {hasYearIndex(stats)
        ? <BatchedCharts kinds={['publications.byIndex']} tenantId={tenantId} unit={unit} bare />
        : charts.map((c, i) => <DirectiveChart key={c.persistKey ?? i} seed={{ ...c, hideTitle: true, hideFrame: true }} />)}
    </ChartPanel>
  );
}

export function TenantChartsTab({ slug, stats, tenantId, charts, unit, contributors }: {
  slug: string; stats: PublicStats; tenantId: number; charts: GraphDirective[]; unit?: string | null;
  contributors?: React.ReactNode;
}) {
  // Cadence re-narrows to the selected unit (tenant-wide at null). Velocity is
  // now server-composed via recompose, so it isn't sourced from here.
  const { cadence } = useScopedAnalytics(slug, unit ?? null, stats);
  const catKinds = ['publications.topJournals', 'publications.collaborators', 'publications.countriesMap'];
  const catTitles: Record<string, string> = {
    'publications.topJournals': ES.charts.topJournals,
    'publications.collaborators': ES.charts.topInstitutions,
    'publications.countriesMap': ES.charts.topCountries,
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
        {/* Citation velocity — server-COMPOSED (publications.velocity), unit-
            scoped through recompose. The composer owns the area+forecast+score
            directive; the panel only renders it (no client chart shaping). */}
        <ChartPanel title={ES.charts.citationVelocity} sub={ES.charts.citationsPerYear}>
          <BatchedCharts kinds={['publications.velocity']} tenantId={tenantId} unit={unit} bare minHeight={240} />
        </ChartPanel>
        {/* ALWAYS render the cadence panel frame. Cadence arrives with the heavy
            analytics merge, so a `cadence ? panel : null` mount inserted a panel
            mid-load — the grid reflowed and the full-width charts below (incl.
            the world map) jumped through the velocity slot ("the chart shifts
            between world map and area chart"). A stable frame with a placeholder
            body keeps the grid geometry fixed from first paint. */}
        <ChartPanel title={ES.charts.publicationCadence} sub={ES.charts.byDocType} tag="stacked · year">
          {cadence
            ? <CadencePanel cadence={cadence} tenantId={tenantId} labels={CADENCE_LABELS_ES} typeLabel={typeLabelEs} />
            : <div style={{ minHeight: 240 }} />}
        </ChartPanel>
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
