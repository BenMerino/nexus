import React, { useState } from 'react';
import type { GraphDirective } from '../architect/graph-composer.types';
import { DirectiveChart } from '../ui/graph-engine/index';
import { BatchedCharts, RecomposeChart } from './recompose-chart';
import { hasYearIndex } from './tenant-year-chart';
import type { PublicStats } from './tenant-builders';
import { ChartPanel, SegToggle } from './tenant-panel';
import { ES } from './tenant-i18n';

/* The merged "Publications per year" panel — ONE full-width yearly chart with
 * a segmentation toggle instead of two stacked charts plotting the same
 * envelope (the old cadence panel + byIndex panel):
 *   - "By type"  → publications.cadence  (stacked by document type)
 *   - "By index" → publications.byIndex  (stacked by WoS/Scopus/SciELO/DOAJ),
 *     offered only when the tenant has indexation data; tenants without it
 *     get "Total" — the client replay-slider fallback directive instead.
 * Every body stays SERVER-COMPOSED (N8); the toggle only picks which kind is
 * fetched. */

type Seg = 'type' | 'index' | 'total';

export function TenantYearPanel({ stats, tenantId, charts, unit }: {
  stats: PublicStats; tenantId: number; charts: GraphDirective[]; unit?: string | null;
}) {
  const indexed = hasYearIndex(stats);
  const [seg, setSeg] = useState<Seg>(indexed ? 'index' : 'type');
  const options: { id: Seg; label: string }[] = [
    { id: 'type', label: ES.charts.segByType },
    indexed ? { id: 'index' as Seg, label: ES.charts.segByIndex }
            : { id: 'total' as Seg, label: ES.charts.segTotal },
  ];
  const sub = seg === 'index' ? ES.charts.byIndexSource
    : seg === 'type' ? ES.charts.byDocType
    : ES.charts.articles;

  return (
    <ChartPanel className="full" title={ES.charts.pubsByYear} sub={sub}
      actions={<SegToggle value={seg} options={options} onChange={setSeg} />}>
      {seg === 'index' && (
        <BatchedCharts kinds={['publications.byIndex']} tenantId={tenantId} unit={unit} bare />
      )}
      {seg === 'type' && (
        <RecomposeChart kind="publications.cadence" tenantId={tenantId} unit={unit} />
      )}
      {seg === 'total' && charts.map((c, i) => (
        <DirectiveChart key={c.persistKey ?? i} seed={{ ...c, hideTitle: true, hideFrame: true }} />
      ))}
    </ChartPanel>
  );
}
