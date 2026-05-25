import React, { useState, useEffect } from 'react';
import { GraphRender } from '../ui/graph-engine/index';
import type { GraphDirective } from '../architect/graph-composer.types';

/* Wraps a replay-capable directive (one carrying `query` + a windowDays toggle)
 * so the public tenant charts get a live time-range slider.
 *
 * Strategy: fetch the FULL atom set once on mount (all-time), hand it to the
 * engine, and let it fold those atoms LOCALLY as the slider drags — that's
 * what the engine is built for (continuous client-side fold, no per-frame
 * round-trips). We do NOT refetch on every onWindowChange; the engine slices
 * its local atoms. We only refetch when a toggle pill picks a coarser window,
 * which is occasional. This removes the drag lag/stutter from a DB round-trip
 * on every animation frame. */
export function ReplayChart({ initial }: { initial: GraphDirective }) {
  const [chart, setChart] = useState<GraphDirective>(initial);

  // Load all-time atoms once so the slider can fold locally.
  useEffect(() => {
    const q = initial.query as { kind?: string; tenantId?: string } | undefined;
    if (!q?.kind || q.tenantId == null) return;
    let cancelled = false;
    fetch('/api/architect/recompose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...q, windowDays: null }),
    })
      .then(r => r.ok ? r.json() : null)
      .then((fresh: GraphDirective | null) => {
        if (cancelled || !fresh) return;
        setChart(prev => ({ ...prev, atoms: fresh.atoms, aggregator: fresh.aggregator, query: fresh.query }));
      })
      .catch(() => { /* keep the static directive */ });
    return () => { cancelled = true; };
  }, [initial]);

  // onWindowChange MUST be present for the engine to show the slider
  // (sliderActive gate). With all atoms local, we don't refetch — we just
  // record the window on the directive's query so the engine folds its local
  // atoms to that window. Cheap: a state update, no DB round-trip per frame.
  return (
    <GraphRender
      chart={chart}
      onWindowChange={({ windowDays, asOf }) =>
        setChart(prev => ({ ...prev, query: { ...(prev.query as object), windowDays, asOf } as typeof prev.query }))}
      onToggle={(_id, value) => {
        const windowDays = value === 'null' ? null : Number(value);
        setChart(prev => ({ ...prev, query: { ...(prev.query as object), windowDays } as typeof prev.query }));
      }}
    />
  );
}
