import React, { useEffect, useMemo, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AuthorsTable } from './tenant-authors';
import { buildTenantCharts } from './tenant-builders';
import { TenantOverview } from './tenant-overview';
import { TenantPublicHeader, type PublicNavItem } from './tenant-header';
import { TabPane } from './tenant-summary';
import { TenantOrgTree, type UnitScope } from './tenant-org-tree';
import { useTenantData, readSlugFromUrl } from './tenant-data';
import { GraphProviders } from '../ui/graph-engine-providers';
import { ES } from './tenant-i18n';
import { bootStreamBridge } from '../architect/websocket-connector';
import { perfMark, perfAutoFlush } from './perf-beacon';

perfMark('boot'); // module evaluated — bundles parsed, app about to mount

// Org scheme is no longer a tab — it's the persistent left rail. The right
// column keeps Overview + Authors as switchable tabs.
const NAV: PublicNavItem[] = [
  { id: 'overview',  label: ES.nav.overview },
  { id: 'authors',   label: ES.nav.authors },
];
const NAV_IDS = new Set(NAV.map(n => n.id));

function initialTabFromHash(): string {
  const h = window.location.hash.replace(/^#/, '');
  return NAV_IDS.has(h) ? h : 'overview';
}

function App() {
  const [slug] = useState<string | null>(() => readSlugFromUrl());
  const { statsPayload, statsError, fatalError } = useTenantData(slug);
  const [active, setActive] = useState<string>(initialTabFromHash);
  const [seen, setSeen] = useState<Set<string>>(() => new Set([active]));
  // Scope lens, shared by the rail (the picker) and the Overview (the content).
  // null = whole organization. Selecting a unit in the rail re-scopes the right.
  const [unit, setUnit] = useState<UnitScope | null>(null);

  // Hash → tab sync: respects browser back/forward and shareable deep links.
  useEffect(() => {
    const onHash = () => {
      const next = initialTabFromHash();
      setActive(next);
      setSeen(prev => prev.has(next) ? prev : new Set(prev).add(next));
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Perf beacon: 'shell' = first paint with chrome (header/nav/overview),
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

  const navigate = (id: string) => {
    setActive(id);
    setSeen(prev => prev.has(id) ? prev : new Set(prev).add(id));
    if (window.location.hash.slice(1) !== id) window.history.replaceState(null, '', `#${id}`);
  };

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

  const paneProps = { active, seen };

  return (
    // GraphProviders wires the engine's EngineConfig (apiGet/dark/pref) +
    // ChartTuning (glow 0) so the vendored charts get the slider span fetch,
    // theme, and persisted toggles. tenantId scopes the per-tenant tuning.
    <GraphProviders tenantId={String(statsPayload.tenant.id)}>
    <div className="public-app">
      <TenantPublicHeader tenant={statsPayload.tenant} items={NAV} currentId={active}
        onNavigate={navigate} yearRange={statsPayload.stats.yearRange} />
      <main className="public-main">
        {/* Two-column: org scheme pinned as the left rail (persistent across
            tabs), the Overview/Authors content on the right. */}
        <div className="tenant-layout">
          <aside className="tenant-rail">
            <h2 className="tenant-rail-title">{ES.nav.orgTree}</h2>
            {/* The rail IS the scope picker: selecting a unit re-scopes the
                right-side Overview; the "All organization" row resets it. */}
            <TenantOrgTree slug={slug} tenantName={statsPayload.tenant.name} selected={unit} onSelect={setUnit} />
          </aside>
          <div className="view tenant-content">
            <TabPane id="overview" {...paneProps}>
              {/* KPI cards + charts — re-scope in place to the unit selected in
                  the rail (Philosophy: scope is sovereign). */}
              <TenantOverview slug={slug} stats={statsPayload.stats} tenantId={statsPayload.tenant.id} charts={charts} unit={unit} />
            </TabPane>

            <TabPane id="authors" {...paneProps}>
              <AuthorsTable slug={slug} />
            </TabPane>
          </div>
        </div>
      </main>
    </div>
    </GraphProviders>
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
