import { useEffect, useState } from 'react';
import type { SparkPoint } from './tenant-kpi-spark';

/* Fetch the per-year KPI sparkline series (publications.kpiSparks catalog kind)
 * via recompose. Plain data — no engine, no slider. Re-fetches with ?unit= so
 * the glyphs re-narrow with the selected faculty, like the KPI numbers above.
 * Returns null until loaded (cards show the number with an empty glyph). */
export interface KpiSparkSeries { publications: SparkPoint[]; citations: SparkPoint[]; authors: SparkPoint[]; oa: SparkPoint[]; }

export function useKpiSparks(tenantId: number, unit: string | null): KpiSparkSeries | null {
  const [series, setSeries] = useState<KpiSparkSeries | null>(null);
  useEffect(() => {
    let cancelled = false;
    setSeries(null);
    fetch('/api/architect/recompose', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'publications.kpiSparks', tenantId: String(tenantId), ...(unit ? { unit } : {}) }),
    })
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: { series?: KpiSparkSeries } | null) => { if (!cancelled) setSeries(d?.series ?? null); })
      .catch(() => { if (!cancelled) setSeries(null); });
    return () => { cancelled = true; };
  }, [tenantId, unit]);
  return series;
}
