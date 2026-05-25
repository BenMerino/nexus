import React, { useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { GraphRender } from '../ui/graph-engine/index';
import { AuthorsTable } from './tenant-authors';
import { TenantGraph, type PublicGraphNode, type PublicGraphEdge } from './tenant-graph';
import { buildTenantCharts, type PublicStats } from './tenant-builders';
import { TenantPublicSidebar, type PublicNavItem } from './tenant-sidebar';
import { SummaryCards, SectionPlaceholder } from './tenant-summary';
import { ReplayChart } from './tenant-replay-chart';

interface TenantChrome {
  id: number; name: string; slug: string | null; ror_id: string | null;
  logo_url: string | null; primary_color: string | null; secondary_color: string | null;
}

interface StatsPayload { tenant: TenantChrome; stats: PublicStats; }
interface GraphPayload { graph: { nodes: PublicGraphNode[]; edges: PublicGraphEdge[] }; }

const NAV: PublicNavItem[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'charts',   label: 'Charts' },
  { id: 'graph',    label: 'Collaboration graph' },
  { id: 'authors',  label: 'Authors directory' },
];

function App() {
  const [slug, setSlug] = useState<string | null>(null);
  const [statsPayload, setStatsPayload] = useState<StatsPayload | null>(null);
  const [graphPayload, setGraphPayload] = useState<GraphPayload | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [graphError, setGraphError] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [active, setActive] = useState<string>('overview');
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const qSlug = new URLSearchParams(window.location.search).get('slug');
    const pathMatch = window.location.pathname.match(/^\/t\/([^\/?#]+)/);
    const s = qSlug || (pathMatch ? pathMatch[1] : null);
    if (!s) { setFatalError('Missing tenant slug.'); return; }
    setSlug(s);

    // Stats: gates the page chrome (title, branding). 404 here = fatal.
    fetch(`/api/public/${encodeURIComponent(s)}/stats`)
      .then(async r => {
        if (r.status === 404) throw new Error('Tenant not found.');
        if (!r.ok) throw new Error(`Stats failed (${r.status})`);
        return r.json() as Promise<StatsPayload>;
      })
      .then(d => {
        setStatsPayload(d);
        if (d.tenant.primary_color) document.body.style.setProperty('--primary', d.tenant.primary_color);
        if (d.tenant.secondary_color) document.body.style.setProperty('--secondary', d.tenant.secondary_color);
        document.title = `${d.tenant.name} — Research`;
      })
      .catch(e => {
        if (e.message === 'Tenant not found.') setFatalError(e.message);
        else setStatsError(e.message);
      });

    // Graph: independent. Failure shows an inline error, doesn't block the page.
    fetch(`/api/public/${encodeURIComponent(s)}/graph`)
      .then(async r => {
        if (!r.ok) throw new Error(`Graph failed (${r.status})`);
        return r.json() as Promise<GraphPayload>;
      })
      .then(setGraphPayload)
      .catch(e => setGraphError(e.message));
  }, []);

  const handleNavigate = (id: string) => {
    setActive(id);
    const el = document.getElementById(id);
    if (el && mainRef.current) mainRef.current.scrollTo({ top: el.offsetTop - 24, behavior: 'smooth' });
  };

  if (fatalError) {
    return <div className="app"><main className="main"><div className="view" style={{ padding: 24, color: 'var(--danger, #c00)' }}>{fatalError}</div></main></div>;
  }
  if (!statsPayload) {
    return <div className="app"><main className="main"><div className="view" style={{ padding: 24, color: 'var(--fg-dim)' }}>{statsError ? `Failed: ${statsError}` : 'Loading…'}</div></main></div>;
  }

  const charts = buildTenantCharts(statsPayload.stats, statsPayload.tenant.id);

  return (
    <div className="app">
      <TenantPublicSidebar tenant={statsPayload.tenant} items={NAV} currentId={active}
        onNavigate={handleNavigate} yearRange={statsPayload.stats.yearRange} />
      <main className="main" ref={mainRef}>
        <div className="view">
          <header className="view-head">
            <div>
              <div className="eyebrow">Institutional research</div>
              <h1 className="view-title">{statsPayload.tenant.name}</h1>
              <div className="view-sub">Public research profile · {statsPayload.stats.summary.totalPubs.toLocaleString()} publications · {statsPayload.stats.summary.authorCount.toLocaleString()} authors</div>
            </div>
          </header>

          <section id="overview" style={{ marginBottom: 24 }}>
            <SummaryCards summary={statsPayload.stats.summary} />
          </section>

          <section id="charts" style={{ marginBottom: 32 }}>
            <h2 style={{ fontFamily: 'var(--display)', fontWeight: 400, fontSize: 22, marginBottom: 12 }}>Charts</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
              {charts.map((chart, i) => (
                <div key={i} className="card" style={{ minHeight: 400 }}>
                  {chart.query ? <ReplayChart initial={chart} /> : <GraphRender chart={chart} />}
                </div>
              ))}
            </div>
          </section>

          <section id="graph" style={{ marginBottom: 32 }}>
            <h2 style={{ fontFamily: 'var(--display)', fontWeight: 400, fontSize: 22, marginBottom: 12 }}>Collaboration graph</h2>
            {graphPayload
              ? <TenantGraph nodes={graphPayload.graph.nodes} edges={graphPayload.graph.edges} />
              : <SectionPlaceholder label="collaboration graph" error={graphError} />}
          </section>

          <section id="authors" style={{ marginBottom: 32 }}>
            <h2 style={{ fontFamily: 'var(--display)', fontWeight: 400, fontSize: 22, marginBottom: 12 }}>Authors directory</h2>
            {slug ? <AuthorsTable slug={slug} /> : null}
          </section>
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
