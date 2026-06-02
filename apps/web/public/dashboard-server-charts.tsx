import React, { useEffect, useState } from 'react';
import { GraphRender } from '../ui/graph-engine/index';
import type { GraphDirective } from '../architect/graph-composer.types';
import { SectionHead } from './ui-primitives';

// Eyebrow label per chart kind (server emits title; the card eyebrow is ours).
const EYEBROW: Record<string, string> = {
  'Publications by Year': 'Output',
  'Top Journals': 'Venues',
  'Top Collaborating Institutions': 'Collaborations',
  'Publications by Country': 'Geography',
};

// The dashboard charts, now SERVER-COMPOSED: fetched as GraphDirectives from
// /api/architect/charts (StatComposer → Statistician resolver) and GraphRendered
// directly, instead of being built client-side from the raw stats payload. Honors
// the ?orcid= viewed-researcher override like the rest of the dashboard.
export function ServerCharts() {
  const [charts, setCharts] = useState<GraphDirective[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const viewOrcid = new URLSearchParams(window.location.search).get('orcid');
    const url = viewOrcid
      ? `/api/architect/charts?orcid=${encodeURIComponent(viewOrcid)}`
      : '/api/architect/charts';
    fetch(url)
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(d => setCharts(d.charts || []))
      .catch(e => setError(String(e)));
  }, []);

  const loading = !charts && !error;
  // While loading/error, render placeholder cards so the grid doesn't reflow.
  const items: (GraphDirective | null)[] = charts ?? [null, null, null, null];

  return (
    <>
      {items.map((chart, i) => (
        <section className="card card-chart" key={chart?.title || i}>
          <SectionHead eyebrow={chart ? (EYEBROW[chart.title] || 'Stats') : 'Stats'} title={chart?.title || '…'} />
          <GraphRender
            chart={chart || ({ type: 'bar', title: '', data: [] } as GraphDirective)}
            isLoading={loading}
            error={error}
          />
        </section>
      ))}
    </>
  );
}
