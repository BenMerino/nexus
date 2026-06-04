import React, { useEffect, useState, useMemo } from 'react';
import { DirectiveChart } from '../ui/graph-engine/index';
import type { GraphDirective } from '../architect/graph-composer.types';
import { perfMark } from './perf-beacon';

/* Renders a SERVER-COMPOSED chart directive — the blessed path for time-series
 * charts: the directive (per-day ISO atoms) is built by the Composer
 * (PublicationCharts), the page never builds it. Two fetch surfaces:
 *   - RecomposeChart: anonymous tenant-public POST /api/architect/recompose
 *   - ScopedChart:    authenticated GET /api/architect/charts?kind= (orcid-scoped)
 * Both render an atom directive via DirectiveChart (uniform-drop toggle). */

function ComposedView({ directive, failed, minHeight, hideTitle }: { directive: GraphDirective | null; failed: boolean; minHeight: number; hideTitle?: boolean }) {
  // hideTitle: the chart sits inside a host card that renders its own heading,
  // so suppress the engine's in-chart title (keep the directive's title for the
  // host/key). Engine honors directive.hideTitle (synced from Zincro).
  const seed = useMemo(() => (directive && hideTitle ? { ...directive, hideTitle: true } : directive), [directive, hideTitle]);
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

/** Tenant-public composed chart (anonymous). No orcid honored here. An optional
 *  `unit` (org-tree node unitKey) narrows the chart to one faculty/department. */
export function RecomposeChart({ kind, tenantId, unit, minHeight = 360 }: { kind: string; tenantId: number; unit?: string | null; minHeight?: number }) {
  const { directive, failed } = useComposed(
    () => fetch('/api/architect/recompose', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, tenantId: String(tenantId), ...(unit ? { unit } : {}) }),
    }),
    [kind, tenantId, unit],
  );
  // Perf beacon: mark when THIS chart's directive resolves — the per-kind
  // timing exposes the "charts fill one by one" stagger.
  useEffect(() => { if (directive || failed) perfMark(`chart:${kind}`); }, [directive, failed, kind]);
  return <ComposedView directive={directive} failed={failed} minHeight={minHeight} />;
}

/** Several public charts composed in ONE round-trip (POST /recompose-batch) and
 *  rendered together — no per-chart stagger. Replaces N <RecomposeChart>s whose
 *  parallel fetches filled in one-by-one. Composition stays per-kind on the
 *  server; only the transport collapses. */
export function BatchedCharts({ kinds, tenantId, unit, minHeight = 400, bare = false, wrap }: { kinds: string[]; tenantId: number; unit?: string | null; minHeight?: number; bare?: boolean; wrap?: (kind: string, body: React.ReactNode) => React.ReactNode }) {
  const [map, setMap] = useState<Record<string, GraphDirective | null> | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/architect/recompose-batch', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: String(tenantId), kinds, ...(unit ? { unit } : {}) }),
    })
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: { directives: Record<string, GraphDirective | null> }) => {
        if (cancelled) return;
        setMap(d.directives || {});
        for (const k of kinds) perfMark(`chart:${k}`);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, kinds.join(','), unit]);
  return (
    <>
      {kinds.map(kind => {
        const d = map ? map[kind] : null;
        const ok = d && ((d as any).atoms || (d as any).data);
        // The choropleth is shape-locked to 2:1 and sizes its own height (the
        // engine letterboxes to nothing); don't impose the generic minHeight
        // floor or its card would leave whitespace below the map.
        const isMap = kind === 'publications.countriesMap';
        // Every BatchedCharts chart is card-wrapped (wrap=ChartPanel or .card),
        // which renders its own heading → suppress the engine's in-chart title.
        const body = <ComposedView directive={ok ? d : null} failed={failed} minHeight={isMap ? 0 : minHeight} hideTitle />;
        // `wrap` lets the caller frame each kind (e.g. a .panel) while keeping
        // the single batch fetch; `bare` skips the default .card; else .card.
        if (wrap) return <React.Fragment key={kind}>{wrap(kind, body)}</React.Fragment>;
        const className = bare ? undefined : 'card';
        return (
          <div key={kind} className={className} style={isMap || bare ? undefined : { minHeight }}>
            {body}
          </div>
        );
      })}
    </>
  );
}

/** Authenticated, scope-narrowed composed chart. The session provides the
 *  tenant; `orcid` (optional) views a specific researcher (admin override).
 *  ctx + orcid narrowing happen server-side in the /charts handler. */
export function ScopedChart({ kind, orcid, minHeight = 360 }: { kind: string; orcid?: string | null; minHeight?: number }) {
  const url = orcid
    ? `/api/architect/charts?kind=${encodeURIComponent(kind)}&orcid=${encodeURIComponent(orcid)}`
    : `/api/architect/charts?kind=${encodeURIComponent(kind)}`;
  const { directive, failed } = useComposed(() => fetch(url, { credentials: 'include' }), [url]);
  // Dashboard ScopedCharts sit in a card with its own SectionHead → hide the
  // engine's in-chart title.
  return <ComposedView directive={directive} failed={failed} minHeight={minHeight} hideTitle />;
}
