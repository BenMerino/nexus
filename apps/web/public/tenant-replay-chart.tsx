import React, { useState } from 'react';
import { GraphRender } from '../ui/graph-engine/index';
import type { GraphDirective } from '../architect/graph-composer.types';

/* Wraps a replay-capable directive (one carrying `query` + a windowDays toggle)
 * so the public tenant charts get a live time-range slider. The engine calls
 * onWindowChange (slider drag) / onToggle (pills); both mutate the query and
 * POST /api/architect/recompose, which returns a fresh directive with
 * window-filtered day-resolution atoms that we swap in. Static charts (no
 * query) just render — this component is only used for ones that have it. */
export function ReplayChart({ initial }: { initial: GraphDirective }) {
  const [chart, setChart] = useState<GraphDirective>(initial);
  const [loading, setLoading] = useState(false);

  async function recompose(nextQuery: Record<string, unknown>) {
    setLoading(true);
    try {
      const r = await fetch('/api/architect/recompose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextQuery),
      });
      if (!r.ok) return;
      const fresh = await r.json() as GraphDirective;
      // preserve the toggles/series the builder set; take fresh atoms+query
      setChart(prev => ({ ...prev, atoms: fresh.atoms, data: fresh.data, query: fresh.query }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <GraphRender
      chart={chart}
      isLoading={loading}
      onWindowChange={({ windowDays, asOf }) =>
        recompose({ ...(chart.query as object), windowDays, asOf })}
      onToggle={(_id, value) => {
        const windowDays = value === 'null' ? null : Number(value);
        recompose({ ...(chart.query as object), windowDays });
      }}
    />
  );
}
