import React, { useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { GraphRender } from '../ui/graph-engine/index';
import { AuthorsTable } from './tenant-authors';
import { TenantGraph } from './tenant-graph';
import { buildTenantCharts } from './tenant-builders';
import { TenantPublicHeader, type PublicNavItem } from './tenant-header';
import { SummaryCards, SectionPlaceholder, TabPane } from './tenant-summary';
import { ReplayChart } from './tenant-replay-chart';
import { TenantOrgTree } from './tenant-org-tree';
import { useTenantData, readSlugFromUrl } from './tenant-data';

const NAV: PublicNavItem[] = [
  { id: 'overview',  label: 'Overview' },
  { id: 'charts',    label: 'Charts' },
  { id: 'graph',     label: 'Collaboration graph' },
  { id: 'org-tree',  label: 'Organisation scheme' },
  { id: 'authors',   label: 'Authors directory' },
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

  const navigate = (id: string) => {
    setActive(id);
    setSeen(prev => prev.has(id) ? prev : new Set(prev).add(id));
    if (window.location.hash.slice(1) !== id) window.history.replaceState(null, '', `#${id}`);
  };

  if (!slug) {
    return <div className="public-app"><main className="public-main" style={{ color: 'var(--danger, #c00)' }}>Missing tenant slug.</main></div>;
  }
  if (fatalError) {
    return <div className="public-app"><main className="public-main" style={{ color: 'var(--danger, #c00)' }}>{fatalError}</main></div>;
  }
  if (!statsPayload) {
    return <div className="public-app"><main className="public-main" style={{ color: 'var(--fg-dim)' }}>{statsError ? `Failed: ${statsError}` : 'Loading…'}</main></div>;
  }

  const charts = buildTenantCharts(statsPayload.stats, statsPayload.tenant.id);
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
              {charts.map((chart, i) => (
                <div key={i} className="card" style={{ minHeight: 400 }}>
                  {chart.query ? <ReplayChart initial={chart} /> : <GraphRender chart={chart} />}
                </div>
              ))}
            </div>
          </TabPane>

          <TabPane id="graph" {...paneProps}>
            {graphPayload
              ? <TenantGraph nodes={graphPayload.graph.nodes} edges={graphPayload.graph.edges} />
              : <SectionPlaceholder label="collaboration graph" error={graphError} />}
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
