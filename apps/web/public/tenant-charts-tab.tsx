import React from 'react';
import type { GraphDirective } from '../architect/graph-composer.types';
import { DirectiveChart } from '../ui/graph-engine/index';
import { BatchedCharts } from './recompose-chart';
import { VelocityPanel } from './portfolio-velocity';
import { CadencePanel } from './portfolio-cadence';
import { hasYearIndex } from './tenant-year-chart';
import type { PublicStats } from './tenant-builders';
import { ES, typeLabelEs, VELOCITY_LABELS_ES, CADENCE_LABELS_ES } from './tenant-i18n';

/* The Charts tab content — extracted from tenant.tsx to keep it under the N5
 * line cap. Renders the velocity + cadence panels and the chart cards. The
 * indexation "Publicaciones por año" stacked chart is SERVER-COMPOSED
 * (publications.byIndex, per-day ISO atoms → uniform-drop toggle); the rest
 * come from the memoized client builders. */
const H3: React.CSSProperties = { fontFamily: 'var(--display)', fontWeight: 400, fontSize: 16, margin: '0 0 12px' };

export function TenantChartsTab({ stats, tenantId, charts, unit }: { stats: PublicStats; tenantId: number; charts: GraphDirective[]; unit?: string | null }) {
  // When a unit is selected, only the server-COMPOSED categorical kinds that
  // honor ?unit= are shown (topJournals/collaborators/countries). The velocity/
  // cadence panels, the client buildYearChart, and byIndex/typeByYear are not
  // yet unit-scoped on the server — hide them rather than show university-wide
  // data under a unit heading (Philosophy: report faithfully).
  const scoped = !!unit;
  // Country distribution renders as the world choropleth (publications.countriesMap)
  // — the map replaces the donut in the view.
  const kinds = scoped
    ? ['publications.topJournals', 'publications.collaborators', 'publications.countriesMap']
    : [
        ...(hasYearIndex(stats) ? ['publications.byIndex'] : []),
        'publications.typeByYear', 'publications.topJournals',
        'publications.collaborators', 'publications.countriesMap',
      ];
  return (
    <>
      {scoped ? null : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 16, marginBottom: 16 }}>
          {stats.velocity ? (
            <section className="card" style={{ padding: 18 }}>
              <h3 style={H3}>{ES.charts.citationVelocity}</h3>
              <VelocityPanel velocity={stats.velocity} labels={VELOCITY_LABELS_ES} />
            </section>
          ) : null}
          {stats.cadence ? (
            <section className="card" style={{ padding: 18 }}>
              <h3 style={H3}>{ES.charts.publicationCadence}</h3>
              <CadencePanel cadence={stats.cadence} tenantId={tenantId} labels={CADENCE_LABELS_ES} typeLabel={typeLabelEs} />
            </section>
          ) : null}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 16 }}>
        {scoped ? null : charts.map((chart, i) => (
          <div key={chart.persistKey ?? i} className="card" style={{ minHeight: 400 }}>
            <DirectiveChart seed={chart} />
          </div>
        ))}
        {/* Server-COMPOSED catalog charts in ONE round-trip. The unit (org-tree
            node key) re-scopes each kind; null ⇒ whole tenant. byIndex/typeByYear
            are tenant-only kinds, dropped from the scoped set above. */}
        <BatchedCharts kinds={kinds} tenantId={tenantId} unit={unit} />
      </div>
    </>
  );
}
