import React from 'react';
import type { GraphDirective } from '../architect/graph-composer.types';
import { DirectiveChart } from '../ui/graph-engine/index';
import { RecomposeChart } from './recompose-chart';
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

export function TenantChartsTab({ stats, tenantId, charts }: { stats: PublicStats; tenantId: number; charts: GraphDirective[] }) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
        {/* Indexation stacked "Publicaciones por año" — server-composed
            (publications.byIndex) so it's a real time-series and the legend
            toggle drops uniformly. No client builder for this chart. */}
        {hasYearIndex(stats) && (
          <div className="card" style={{ minHeight: 400 }}>
            <RecomposeChart kind="publications.byIndex" tenantId={tenantId} minHeight={400} />
          </div>
        )}
        {charts.map((chart, i) => (
          <div key={chart.persistKey ?? i} className="card" style={{ minHeight: 400 }}>
            <DirectiveChart seed={chart} />
          </div>
        ))}
        {/* Categorical charts — server-COMPOSED catalog kinds (no client-side
            GraphDirective.data). Each is one AnalyticsCatalog entry. */}
        {['publications.topJournals', 'publications.collaborators', 'publications.countries'].map(kind => (
          <div key={kind} className="card" style={{ minHeight: 400 }}>
            <RecomposeChart kind={kind} tenantId={tenantId} minHeight={400} />
          </div>
        ))}
      </div>
    </>
  );
}
