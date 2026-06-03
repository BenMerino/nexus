import React, { useEffect, useMemo, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AuthorsTable } from './tenant-authors';
import { TenantGraph } from './tenant-graph';
import { buildTenantCharts } from './tenant-builders';
import { TenantChartsTab } from './tenant-charts-tab';
import { TenantPublicHeader, type PublicNavItem } from './tenant-header';
import { SummaryCards, SectionPlaceholder, TabPane } from './tenant-summary';
import { TenantOrgTree } from './tenant-org-tree';
import { useTenantData, readSlugFromUrl } from './tenant-data';
import { ES } from './tenant-i18n';
import { bootStreamBridge } from '../architect/websocket-connector';
import { perfMark, perfAutoFlush } from './perf-beacon';

perfMark('boot'); // module evaluated — bundles parsed, app about to mount

const NAV: PublicNavItem[] = [
  { id: 'overview',  label: ES.nav.overview },
  { id: 'charts',    label: ES.nav.charts },
  { id: 'graph',     label: ES.nav.graph },
  { id: 'org-tree',  label: ES.nav.orgTree },
  { id: 'authors',   label: ES.nav.authors },
];
const NAV_IDS = new Set(NAV.map(n => n.id));

function initialTabFromHash(): string {
  const h = window.location.hash.replace(/^#/, '');
  return NAV_IDS.has(h) ? h : 'overview';
}

function App() {
  const [slug] = useState<string | null>(() => readSlugFromUrl());
  const { statsPayload, graphPayload, statsError, graphError, fatalError } = useTenantData(slug);
  const [active, setActive] = useState<string>(initialTabFromHash);
  const [seen, setSeen] = useState<Set<string>>(() => new Set([active]));

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
    return <div className="public-app"><main className="public-main" style={{ color: 'var(--fg-dim)' }}>{statsError ? `${ES.failedPrefix}: ${statsError}` : ES.loading}</main></div>;
  }

  const paneProps = { active, seen };

  return (
    <div className="public-app">
      <TenantPublicHeader tenant={statsPayload.tenant} items={NAV} currentId={active}
        onNavigate={navigate} yearRange={statsPayload.stats.yearRange} />
      <main className="public-main">
        <div className="view">
          <TabPane id="overview" {...paneProps}>
            <SummaryCards summary={statsPayload.stats.summary} />
          </TabPane>

          <TabPane id="charts" {...paneProps}>
            <TenantChartsTab stats={statsPayload.stats} tenantId={statsPayload.tenant.id} charts={charts} />
          </TabPane>

          <TabPane id="graph" {...paneProps}>
            {graphPayload
              ? <TenantGraph nodes={graphPayload.graph.nodes} edges={graphPayload.graph.edges} />
              : <SectionPlaceholder label={ES.collaborationGraph} error={graphError} />}
          </TabPane>

          <TabPane id="org-tree" {...paneProps}>
            <TenantOrgTree slug={slug} />
          </TabPane>

          <TabPane id="authors" {...paneProps}>
            <AuthorsTable slug={slug} />
          </TabPane>
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
