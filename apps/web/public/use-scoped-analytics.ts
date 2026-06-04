import { useEffect, useState } from 'react';
import type { PublicStats } from './tenant-builders';

/* Velocity + cadence for the active scope. At "all units" the tenant-wide
 * values from the initial analytics fetch are reused (no extra request); when a
 * unit is selected, re-fetch /stats?analytics=1&unit= so the velocity line and
 * cadence bars genuinely re-narrow to that faculty/department (the server now
 * unit-scopes them). Returns the scope's velocity/cadence, falling back to the
 * tenant-wide pair while a unit fetch is in flight or on error. */
type VC = Pick<PublicStats, 'velocity' | 'cadence'>;
export function useScopedAnalytics(slug: string, unit: string | null, stats: PublicStats): VC {
  const base: VC = { velocity: stats.velocity, cadence: stats.cadence };
  const [scoped, setScoped] = useState<VC>(base);
  useEffect(() => {
    if (!unit) { setScoped({ velocity: stats.velocity, cadence: stats.cadence }); return; }
    let cancelled = false;
    fetch(`/api/public/${encodeURIComponent(slug)}/stats?analytics=1&unit=${encodeURIComponent(unit)}`)
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: { stats: PublicStats }) => { if (!cancelled) setScoped({ velocity: d.stats.velocity, cadence: d.stats.cadence }); })
      .catch(() => { if (!cancelled) setScoped({ velocity: stats.velocity, cadence: stats.cadence }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, unit, stats]);
  return unit ? scoped : base;
}
