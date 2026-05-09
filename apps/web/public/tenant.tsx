import React, { useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { GraphRender } from '../graph-engine/index';
import { AuthorsTable, type AuthorRow } from './tenant-authors';
import { TenantGraph, type PublicGraphNode, type PublicGraphEdge } from './tenant-graph';
import { buildTenantCharts, type PublicStats } from './tenant-builders';
import { TenantPublicSidebar, type PublicNavItem } from './tenant-sidebar';

interface PublicPayload {
  tenant: {
    id: number; name: string; slug: string | null; ror_id: string | null;
    logo_url: string | null; primary_color: string | null; secondary_color: string | null;
  };
  stats: PublicStats;
  authors: AuthorRow[];
  graph: { nodes: PublicGraphNode[]; edges: PublicGraphEdge[] };
}

const NAV: PublicNavItem[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'charts',   label: 'Charts' },
  { id: 'graph',    label: 'Collaboration graph' },
  { id: 'authors',  label: 'Authors directory' },
];

function SummaryCards({ summary }: { summary: PublicStats['summary'] }) {
  const oaPct = summary.totalPubs > 0 ? Math.round((summary.oaCount / summary.totalPubs) * 100) : 0;
  const cards = [
    { label: 'Publications', value: summary.totalPubs.toLocaleString() },
    { label: 'Citations', value: summary.totalCitations.toLocaleString() },
    { label: 'Open access', value: `${oaPct}%` },
    { label: 'Authors', value: summary.authorCount.toLocaleString() },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: '1.5rem' }}>
      {cards.map((c, i) => (
        <div key={i} className="card" style={{ textAlign: 'center', padding: 18 }}>
          <div style={{ fontSize: 28, fontWeight: 500, fontFamily: 'var(--display)' }}>{c.value}</div>
          <div style={{ fontSize: 11, color: 'var(--fg-dim)', marginTop: 4, fontFamily: 'var(--mono)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{c.label}</div>
        </div>
      ))}
    </div>
  );
}

function App() {
  const [data, setData] = useState<PublicPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<string>('overview');
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const qSlug = new URLSearchParams(window.location.search).get('slug');
    const pathMatch = window.location.pathname.match(/^\/t\/([^\/?#]+)/);
    const slug = qSlug || (pathMatch ? pathMatch[1] : null);
    if (!slug) { setError('Missing tenant slug.'); return; }
    fetch(`/api/public/${encodeURIComponent(slug)}`)
      .then(async r => {
        if (r.status === 404) throw new Error('Tenant not found.');
        if (!r.ok) throw new Error('Failed to load tenant data.');
        return r.json();
      })
      .then((d: PublicPayload) => {
        setData(d);
        const body = document.body;
        if (d.tenant.primary_color) body.style.setProperty('--primary', d.tenant.primary_color);
        if (d.tenant.secondary_color) body.style.setProperty('--secondary', d.tenant.secondary_color);
        document.title = `${d.tenant.name} — Research`;
      })
      .catch(e => setError(e.message));
  }, []);

  const handleNavigate = (id: string) => {
    setActive(id);
    const el = document.getElementById(id);
    if (el && mainRef.current) mainRef.current.scrollTo({ top: el.offsetTop - 24, behavior: 'smooth' });
  };

  if (error) {
    return <div className="app"><main className="main"><div className="view" style={{ padding: 24, color: 'var(--danger, #c00)' }}>{error}</div></main></div>;
  }
  if (!data) {
    return <div className="app"><main className="main"><div className="view" style={{ padding: 24, color: 'var(--fg-dim)' }}>Loading…</div></main></div>;
  }

  const charts = buildTenantCharts(data.stats);

  return (
    <div className="app">
      <TenantPublicSidebar tenant={data.tenant} items={NAV} currentId={active}
        onNavigate={handleNavigate} yearRange={data.stats.yearRange} />
      <main className="main" ref={mainRef}>
        <div className="view">
          <header className="view-head">
            <div>
              <div className="eyebrow">Institutional research</div>
              <h1 className="view-title">{data.tenant.name}</h1>
              <div className="view-sub">Public research profile · {data.stats.summary.totalPubs.toLocaleString()} publications · {data.stats.summary.authorCount.toLocaleString()} authors</div>
            </div>
          </header>

          <section id="overview" style={{ marginBottom: 24 }}>
            <SummaryCards summary={data.stats.summary} />
          </section>

          <section id="charts" style={{ marginBottom: 32 }}>
            <h2 style={{ fontFamily: 'var(--display)', fontWeight: 400, fontSize: 22, marginBottom: 12 }}>Charts</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
              {charts.map((chart, i) => (
                <div key={i} className="card" style={{ minHeight: 400 }}>
                  <GraphRender chart={chart} />
                </div>
              ))}
            </div>
          </section>

          <section id="graph" style={{ marginBottom: 32 }}>
            <h2 style={{ fontFamily: 'var(--display)', fontWeight: 400, fontSize: 22, marginBottom: 12 }}>Collaboration graph</h2>
            <TenantGraph nodes={data.graph.nodes} edges={data.graph.edges} />
          </section>

          <section id="authors" style={{ marginBottom: 32 }}>
            <h2 style={{ fontFamily: 'var(--display)', fontWeight: 400, fontSize: 22, marginBottom: 12 }}>Authors directory</h2>
            <AuthorsTable authors={data.authors} />
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
