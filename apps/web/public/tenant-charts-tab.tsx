import React from 'react';
import type { GraphDirective } from '../architect/graph-composer.types';
import { BatchedCharts } from './recompose-chart';
import type { PublicStats } from './tenant-builders';
import { ChartPanel } from './tenant-panel';
import { TenantYearPanel } from './tenant-year-panel';
import { ES } from './tenant-i18n';

/* The chart grid: contributors hero tall-left, velocity + research-areas
 * stacked right, then ONE full-width "Publications per year" panel (the old
 * cadence + byIndex charts merged behind a segmentation toggle —
 * tenant-year-panel), then the categorical kinds (journals / collaborators /
 * countries map). All charts stay SERVER-COMPOSED (N8) — only the .panel frame
 * is the design's. The server unit-scopes every kind, so selecting a faculty
 * re-narrows the whole grid in place. */

const HERO_KINDS = ['publications.velocity', 'publications.researchAreas'];
const CAT_KINDS = ['publications.topJournals', 'publications.collaborators', 'publications.countriesMap'];

export function TenantChartsTab({ stats, tenantId, charts, unit, contributors }: {
  stats: PublicStats; tenantId: number; charts: GraphDirective[]; unit?: string | null;
  contributors?: React.ReactNode;
}) {
  const heroChrome: Record<string, { title: string; sub: string }> = {
    'publications.velocity': { title: ES.charts.citationVelocity, sub: ES.charts.citationsPerYear },
    'publications.researchAreas': { title: ES.charts.researchAreas, sub: ES.charts.researchAreasSub },
  };
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
        {/* Velocity + research areas in ONE batch round-trip, each in its own
            panel — they fill the right column beside the contributors hero. */}
        <BatchedCharts kinds={HERO_KINDS} tenantId={tenantId} unit={unit} minHeight={240}
          wrap={(kind, body) => (
            <ChartPanel title={heroChrome[kind].title} sub={heroChrome[kind].sub}>
              {body}
            </ChartPanel>
          )} />
        <TenantYearPanel stats={stats} tenantId={tenantId} charts={charts} unit={unit} />
      </div>
      {/* Categorical kinds in ONE batch round-trip, each framed in its own
          panel via `wrap` (journals/collaborators half-width, the map full). */}
      <div className="chart-grid" style={{ marginTop: 24 }}>
        <BatchedCharts kinds={CAT_KINDS} tenantId={tenantId} unit={unit}
          wrap={(kind, body) => (
            <ChartPanel className={kind === 'publications.countriesMap' ? 'full' : ''} title={catTitles[kind]}>
              {body}
            </ChartPanel>
          )} />
      </div>
    </>
  );
}
