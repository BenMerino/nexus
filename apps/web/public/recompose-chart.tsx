import React, { useEffect, useState, useMemo } from 'react';
import { DirectiveChart } from '../ui/graph-engine/index';
import type { GraphDirective } from '../architect/graph-composer.types';
import { perfMark } from './perf-marks';

/* Renders a SERVER-COMPOSED chart directive — the blessed path for time-series
 * charts: the directive (per-day ISO atoms) is built by the Composer
 * (PublicationCharts), the page never builds it. Two fetch surfaces:
 *   - RecomposeChart: anonymous tenant-public POST /api/architect/recompose
 *   - ScopedChart:    authenticated GET /api/architect/charts?kind= (orcid-scoped)
 * Both render an atom directive via DirectiveChart (uniform-drop toggle). */

function ComposedView({ directive, failed, pending, minHeight, hideTitle, fixed }: { directive: GraphDirective | null; failed: boolean; pending?: boolean; minHeight: number; hideTitle?: boolean; fixed?: boolean }) {
  // hideTitle: the chart sits inside a host card that renders its own heading +
  // border, so suppress the engine's in-chart title AND its redundant plot frame
  // (keep the directive's title for the host/key). Engine honors both flags
  // (synced from Zincro).
  const seed = useMemo(() => (directive && hideTitle ? { ...directive, hideTitle: true, hideFrame: true } : directive), [directive, hideTitle]);
  if (failed || (!seed && !pending)) {
    return <div style={{ minHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-dim)', fontFamily: 'var(--mono)', fontSize: 13 }}>—</div>;
  }
  // Pending and loaded states share this ONE .chart-surface node: the rung-2
  // glass (tint, concentric corner, kube filter geometry) is already correct
  // BEFORE the directive lands, and the chart mounts into the same element —
  // no node swap, so no tint pop and no filter re-bucket at data arrival.
  //
  // `fixed` (opt-in) locks the surface to an EXACT height so it can't grow the
  // card when the directive lands (the tenant overview reserves precise sizes
  // for a no-reflow load). Default is min-height (grow-to-fit) — the correct
  // behavior everywhere else (dashboard etc.), where the passed height is a
  // FLOOR, not the chart's true size. A bare min-height passed as a fixed
  // height clips the chart (that regressed dashboard's Citation velocity).
  const sizing = fixed ? { height: minHeight } : { minHeight };
  return <div className="chart-surface" style={sizing}>{seed ? <DirectiveChart seed={seed} /> : null}</div>;
}

function useComposed(doFetch: () => Promise<Response>, deps: unknown[]) {
  const [directive, setDirective] = useState<GraphDirective | null>(null);
  const [failed, setFailed] = useState(false);
  // pending distinguishes "fetch in flight" (tinted empty surface) from
  // "resolved empty" (the — placeholder) in ComposedView.
  const [pending, setPending] = useState(true);
  useEffect(() => {
    let cancelled = false;
    doFetch()
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      // Accept time-series (atoms) AND categorical (data) directives — both are
      // valid server-composed kinds; only an empty/null payload is dropped.
      .then((d: GraphDirective | null) => { if (!cancelled) setDirective(d && ((d as any).atoms || (d as any).data) ? d : null); })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setPending(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { directive, failed, pending };
}

/** Tenant-public composed chart (anonymous). No orcid honored here. An optional
 *  `unit` (org-tree node unitKey) narrows the chart to one faculty/department. */
export function RecomposeChart({ kind, tenantId, unit, minHeight = 360 }: { kind: string; tenantId: number; unit?: string | null; minHeight?: number }) {
  const { directive, failed, pending } = useComposed(
    () => fetch('/api/architect/recompose', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, tenantId: String(tenantId), ...(unit ? { unit } : {}) }),
    }),
    [kind, tenantId, unit],
  );
  // Perf beacon: mark when THIS chart's directive resolves — the per-kind
  // timing exposes the "charts fill one by one" stagger.
  useEffect(() => { if (directive || failed) perfMark(`chart:${kind}`); }, [directive, failed, kind]);
  // Card-wrapped like the rest (CadencePanel etc. sit in a .panel with its own
  // heading + border) → suppress the engine's title + plot frame.
  return <ComposedView directive={directive} failed={failed} pending={pending} minHeight={minHeight} hideTitle />;
}

/** Several public charts composed in ONE round-trip (POST /recompose-batch) and
 *  rendered together — no per-chart stagger. Replaces N <RecomposeChart>s whose
 *  parallel fetches filled in one-by-one. Composition stays per-kind on the
 *  server; only the transport collapses. */
export function BatchedCharts({ kinds, tenantId, unit, minHeight = 400, heightFor, bare = false, wrap }: { kinds: string[]; tenantId: number; unit?: string | null; minHeight?: number; heightFor?: (kind: string) => number; bare?: boolean; wrap?: (kind: string, body: React.ReactNode) => React.ReactNode }) {
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
        // Per-kind RESERVED height (tenant-card-sizes) so the chart body is its
        // final size from first paint — content renders into a pre-sized box and
        // never grows it (no load-time reflow → nothing to animate). Falls back
        // to the batch minHeight when no per-kind height is given.
        const kh = heightFor ? heightFor(kind) : minHeight;
        // fixed height ONLY when the caller gave a per-kind reserved size
        // (heightFor) — i.e. the tenant overview. Otherwise grow-to-fit.
        const body = <ComposedView directive={ok ? d : null} failed={failed} pending={!map && !failed} minHeight={isMap ? 0 : kh} hideTitle fixed={!!heightFor && !isMap} />;
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
  const { directive, failed, pending } = useComposed(() => fetch(url, { credentials: 'include' }), [url]);
  // Dashboard ScopedCharts sit in a card with its own SectionHead → hide the
  // engine's in-chart title.
  return <ComposedView directive={directive} failed={failed} pending={pending} minHeight={minHeight} hideTitle />;
}
