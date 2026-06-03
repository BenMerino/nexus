import React, { useEffect, useState, useMemo } from 'react';
import { DirectiveChart } from '../ui/graph-engine/index';
import type { GraphDirective } from '../architect/graph-composer.types';

/* Renders a SERVER-COMPOSED chart directive — the blessed path for time-series
 * charts: the directive (per-day ISO atoms) is built by the Composer
 * (PublicationCharts), the page never builds it. Two fetch surfaces:
 *   - RecomposeChart: anonymous tenant-public POST /api/architect/recompose
 *   - ScopedChart:    authenticated GET /api/architect/charts?kind= (orcid-scoped)
 * Both render an atom directive via DirectiveChart (uniform-drop toggle). */

function ComposedView({ directive, failed, minHeight }: { directive: GraphDirective | null; failed: boolean; minHeight: number }) {
  const seed = useMemo(() => directive, [directive]);
  if (failed || seed === null) {
    return <div style={{ minHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-dim)', fontFamily: 'var(--mono)', fontSize: 13 }}>—</div>;
  }
  return <div style={{ minHeight }}><DirectiveChart seed={seed} /></div>;
}

function useComposed(doFetch: () => Promise<Response>, deps: unknown[]) {
  const [directive, setDirective] = useState<GraphDirective | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    doFetch()
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      // Accept time-series (atoms) AND categorical (data) directives — both are
      // valid server-composed kinds; only an empty/null payload is dropped.
      .then((d: GraphDirective | null) => { if (!cancelled) setDirective(d && ((d as any).atoms || (d as any).data) ? d : null); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { directive, failed };
}

/** Tenant-public composed chart (anonymous). No orcid honored here. */
export function RecomposeChart({ kind, tenantId, minHeight = 360 }: { kind: string; tenantId: number; minHeight?: number }) {
  const { directive, failed } = useComposed(
    () => fetch('/api/architect/recompose', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, tenantId: String(tenantId) }),
    }),
    [kind, tenantId],
  );
  return <ComposedView directive={directive} failed={failed} minHeight={minHeight} />;
}

/** Authenticated, scope-narrowed composed chart. The session provides the
 *  tenant; `orcid` (optional) views a specific researcher (admin override).
 *  ctx + orcid narrowing happen server-side in the /charts handler. */
export function ScopedChart({ kind, orcid, minHeight = 360 }: { kind: string; orcid?: string | null; minHeight?: number }) {
  const url = orcid
    ? `/api/architect/charts?kind=${encodeURIComponent(kind)}&orcid=${encodeURIComponent(orcid)}`
    : `/api/architect/charts?kind=${encodeURIComponent(kind)}`;
  const { directive, failed } = useComposed(() => fetch(url, { credentials: 'include' }), [url]);
  return <ComposedView directive={directive} failed={failed} minHeight={minHeight} />;
}
