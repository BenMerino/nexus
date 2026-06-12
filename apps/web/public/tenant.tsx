import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { buildTenantCharts } from './tenant-builders';
import { ScopedSummary } from './tenant-summary';
import { TenantPublicHeader, type PublicNavItem } from './tenant-header';
import { TenantScopeRail } from './tenant-scope-rail';
import { useUnitScope } from './use-unit-scope';
import { TenantSearch } from './tenant-search';
import { TenantFooter } from './tenant-footer';
import { useTenantData, readSlugFromUrl } from './tenant-data';
import { ES } from './tenant-i18n';
import { bootStreamBridge } from '../architect/websocket-connector';
import { perfMark, perfAutoFlush } from './perf-marks';

perfMark('boot'); // module evaluated — bundles parsed, app about to mount

// The chart grid + engine providers live behind React.lazy: their import chain
// carries the vendored graph engine (~380KB chunk), which would otherwise gate
// the shell's first paint. The charts wait on their data fetches anyway, so
// deferring the code costs nothing visible.
const TenantBody = React.lazy(() => import('./tenant-body'));

// No tabs: org scheme is the left rail, and Authors folded into the Overview
// (scoped to the rail's selection). One content view → no top nav tabs.
const NAV: PublicNavItem[] = [];

function App() {
  const [slug] = useState<string | null>(() => readSlugFromUrl());
  const { statsPayload, statsError, fatalError } = useTenantData(slug);
  // Scope lens, shared by the rail (the picker) and the Overview (the content).
  // null = whole organization. URL mirroring + the deep-link chart gate live in
  // use-unit-scope (?unit= loads hold the chart grid until the rail resolves).
  const { initialUnitKey, unit, setUnit, unitReady, markUnitReady } = useUnitScope();

  // Perf beacon: 'shell' = first paint with chrome (header/overview),
  // 'analytics' = heavy chart data merged in. The gap between them, and how
  // long after 'analytics' the page settles, is the load story we're capturing.
  useEffect(() => {
    if (!statsPayload) return;
    perfMark('shell');
    // velocity arrives only with the analytics merge — use it as the marker
    // that the heavy phase landed (chrome seed has no velocity).
    if (statsPayload.stats.velocity) perfMark('analytics');
    if (slug) perfAutoFlush(slug);
  }, [statsPayload, slug]);

  // Preload the engine chunk in parallel with the org-tree fetch, so the
  // deep-link gate costs layout stability, not time-to-charts.
  useEffect(() => { void import('./tenant-body'); }, []);

  // Memoize ABOVE the early returns — hooks must run unconditionally every
  // render (React #310). Guards on statsPayload internally and yields [] until
  // data lands. Stable identity so a legend toggle inside DirectiveChart can't
  // rebuild the seed (which would re-seed the engine's activeSet = "reload").
  const charts = useMemo(
    () => statsPayload ? buildTenantCharts(statsPayload.stats, statsPayload.tenant.id) : [],
    [statsPayload],
  );

  if (!slug) {
    return <div className="public-app"><main className="public-main" style={{ color: 'var(--danger, #c00)' }}>{ES.missingSlug}</main></div>;
  }
  if (fatalError) {
    return <div className="public-app"><main className="public-main" style={{ color: 'var(--danger, #c00)' }}>{fatalError}</main></div>;
  }
  if (!statsPayload) {
    // Chrome lands in ~0.5s, so show a quiet blank shell, not a "Loading…"
    // flash. An error still surfaces (it's not transient).
    return <div className="public-app"><main className="public-main" style={{ color: 'var(--fg-dim)' }}>{statsError ? `${ES.failedPrefix}: ${statsError}` : ''}</main></div>;
  }

  return (
    <div className="public-app">
      <TenantPublicHeader tenant={statsPayload.tenant} items={NAV} currentId="overview"
        onNavigate={() => {}} yearRange={statsPayload.stats.yearRange}
        lastUpdated={statsPayload.stats.lastUpdated} />
      <main className="public-main">
        <div className="public-content">
        {/* Omnibox left (researchers / publications / units), live "viewing
            scope" flag right — reflects the unit selected in the rail. */}
        <div className="page-head">
          <TenantSearch slug={slug} onSelectUnit={setUnit} />
          <div className="scope-flag">
            {ES.pageHead.scopeLabel}<br />
            <b>{unit?.name ?? ES.pageHead.allUnits}</b><br />
            <span>{unit ? ES.pageHead.unitNote : ES.pageHead.allUnitsNote}</span>
          </div>
        </div>
        {/* KPI row spans the full width above the rail + chart grid (mockup). */}
        <ScopedSummary slug={slug} stats={statsPayload.stats} tenantId={statsPayload.tenant.id} unit={unit} />
        {/* Two-column: scope rail (the picker) pinned left, the scoped chart
            grid + author directory on the right. */}
        <div className="tenant-layout">
          <aside className="tenant-rail">
            {/* The rail IS the scope picker: selecting a unit re-scopes the
                right-side Overview; the "All units" row resets it. */}
            <div className="tenant-rail-head">
              <h2 className="tenant-rail-title">{ES.scopeRail.title}</h2>
              <p className="tenant-rail-note">{ES.scopeRail.note}</p>
            </div>
            <div className="tenant-rail-list">
              <TenantScopeRail slug={slug} tenantName={statsPayload.tenant.name} selected={unit} onSelect={setUnit}
                initialKey={initialUnitKey} onInitialResolved={markUnitReady} />
            </div>
          </aside>
          <div className="tenant-content">
            {/* KPI cards + charts + author directory — all re-scope in place to
                the unit selected in the rail (Philosophy: scope is sovereign).
                Lazy (engine chunk); panels appear when the code lands. */}
            {unitReady ? (
              <Suspense fallback={<div style={{ minHeight: 600 }} />}>
                <TenantBody slug={slug} stats={statsPayload.stats} tenantId={statsPayload.tenant.id} charts={charts} unit={unit} />
              </Suspense>
            ) : <div style={{ minHeight: 600 }} />}
          </div>
        </div>
        <TenantFooter yearRange={statsPayload.stats.yearRange} />
        </div>
      </main>
    </div>
  );
}

let tenantRoot: Root | null = null;
function mount() {
  const el = document.getElementById('tenant-root');
  if (!el) return;
  if (tenantRoot) tenantRoot.unmount();
  tenantRoot = createRoot(el);
  tenantRoot.render(<App />);
}
(window as any).__nexusMounts = (window as any).__nexusMounts || {};
(window as any).__nexusMounts[new URL(import.meta.url).pathname] = mount;
mount();
// Open the directive Stream bridge so charts go live (isLive) and re-push on
// ingestion. Idempotent; falls back to HTTP recompose when the socket is down.
bootStreamBridge();
