import React from 'react';
import type { GraphDirective } from '../architect/graph-composer.types';
import type { PublicStats } from './tenant-builders';
import type { UnitScope } from './tenant-unit-scope-type';
import { BatchedCharts } from './recompose-chart';
import { ChartPanel } from './tenant-panel';
import { TenantYearPanel } from './tenant-year-panel';
import { TenantContributors } from './tenant-contributors';
import { TenantWorks } from './tenant-works';
import { AuthorsTable } from './tenant-authors';
import { SectionPlaceholder } from './tenant-section-placeholder';
import { ES } from './tenant-i18n';

/* Right-pane content per IA section (tenant-sections). Every chart stays
 * SERVER-COMPOSED (N8); the catalog kinds are just regrouped from the old
 * single grid into the 6 sections. Each view is unit-scoped via `unitKey`, so
 * the in-view unit dropdown re-narrows whatever section is open. */

interface ViewProps {
  slug: string; stats: PublicStats; tenantId: number;
  charts: GraphDirective[]; unit: UnitScope | null;
}

function panelize(titles: Record<string, string>, full?: string) {
  return (kind: string, body: React.ReactNode) => (
    <ChartPanel className={kind === full ? 'full' : ''} title={titles[kind]}>{body}</ChartPanel>
  );
}

function Overview({ stats, tenantId, charts, unit }: ViewProps) {
  // Global Metrics = the KPI row (rendered above by tenant.tsx). Temporal Trends
  // = velocity (citations/yr) + the merged publications-per-year panel.
  return (
    <>
      <div className="chart-grid">
        <BatchedCharts kinds={['publications.velocity']} tenantId={tenantId} unit={unit?.unitKey ?? null}
          minHeight={240} wrap={(_k, body) => (
            <ChartPanel title={ES.charts.citationVelocity} sub={ES.charts.citationsPerYear}>{body}</ChartPanel>
          )} />
        <TenantYearPanel stats={stats} tenantId={tenantId} charts={charts} unit={unit?.unitKey ?? null} />
      </div>
    </>
  );
}

function Faculties({ slug, tenantId, unit }: ViewProps) {
  // Comparative Matrix = the cross-unit contributors ranking (the old rail's
  // data, now a first-class panel). Subject Categories = OpenAlex research areas.
  return (
    <div className="chart-grid">
      <ChartPanel className="tall" title={ES.contributors.title} sub={ES.contributors.volume} tag="by unit">
        <TenantContributors slug={slug} />
      </ChartPanel>
      <BatchedCharts kinds={['publications.researchAreas']} tenantId={tenantId} unit={unit?.unitKey ?? null}
        minHeight={240} wrap={(_k, body) => (
          <ChartPanel title={ES.charts.researchAreas} sub={ES.charts.researchAreasSub}>{body}</ChartPanel>
        )} />
    </div>
  );
}

function Researchers({ slug, unit }: ViewProps) {
  // High-Impact Authors = most-cited works + the author directory (h-index /
  // citations columns). Emerging Talent is 'soon' (no career-start data).
  return (
    <>
      <TenantWorks slug={slug} unit={unit?.unitKey ?? null} />
      <section style={{ marginTop: 24 }}>
        <h3 className="panel-title" style={{ marginBottom: 12 }}>{ES.nav.authors}</h3>
        <AuthorsTable slug={slug} unit={unit?.unitKey ?? null} />
      </section>
    </>
  );
}

function Venues({ tenantId, unit }: ViewProps) {
  // Open Access Tracker = top journals (the venue dimension we have) + OA share
  // lives in the KPI sparks above. Quartile distribution is 'soon'.
  return (
    <div className="chart-grid">
      <BatchedCharts kinds={['publications.topJournals']} tenantId={tenantId} unit={unit?.unitKey ?? null}
        wrap={panelize({ 'publications.topJournals': ES.charts.topJournals })} />
    </div>
  );
}

function Collaboration({ tenantId, unit }: ViewProps) {
  // International Co-authorship = countries choropleth + top collaborating
  // institutions. Industry synergies is 'soon' (no sector classification).
  return (
    <div className="chart-grid">
      <BatchedCharts kinds={['publications.countriesMap', 'publications.collaborators']}
        tenantId={tenantId} unit={unit?.unitKey ?? null}
        wrap={panelize({
          'publications.countriesMap': ES.charts.topCountries,
          'publications.collaborators': ES.charts.topInstitutions,
        }, 'publications.countriesMap')} />
    </div>
  );
}

export function SectionView({ section, ...props }: ViewProps & { section: string }) {
  switch (section) {
    case 'overview': return <Overview {...props} />;
    case 'faculties': return <Faculties {...props} />;
    case 'researchers': return <Researchers {...props} />;
    case 'venues': return <Venues {...props} />;
    case 'collaboration': return <Collaboration {...props} />;
    case 'funding': return <SectionPlaceholder title="Funding & Grants Performance" />;
    default: return <Overview {...props} />;
  }
}
