import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GraphRender } from '../graph-engine/index.js';
import { TenantHeader } from './tenant-header';
import { AuthorsTable, type AuthorRow } from './tenant-authors';
import { TenantGraph, type PublicGraphNode, type PublicGraphEdge } from './tenant-graph';
import { buildTenantCharts, type PublicStats } from './tenant-builders';

interface PublicPayload {
  tenant: {
    id: number; name: string; slug: string | null; ror_id: string | null;
    logo_url: string | null; primary_color: string | null; secondary_color: string | null;
  };
  stats: PublicStats;
  authors: AuthorRow[];
  graph: { nodes: PublicGraphNode[]; edges: PublicGraphEdge[] };
}

function SummaryCards({ summary }: { summary: PublicStats['summary'] }) {
  const oaPct = summary.totalPubs > 0
    ? Math.round((summary.oaCount / summary.totalPubs) * 100)
    : 0;
  const cards = [
    { label: 'Publications', value: summary.totalPubs.toLocaleString() },
    { label: 'Citations', value: summary.totalCitations.toLocaleString() },
    { label: 'Open Access', value: `${oaPct}%` },
    { label: 'Authors', value: summary.authorCount.toLocaleString() },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: '1.5rem' }}>
      {cards.map((c, i) => (
        <div key={i} style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 6, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 'bold' }}>{c.value}</div>
          <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{c.label}</div>
        </div>
      ))}
    </div>
  );
}

function App() {
  const [data, setData] = useState<PublicPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  if (error) return <div style={{ padding: 24, color: '#c00' }}>{error}</div>;
  if (!data) return <div style={{ padding: 24, color: '#999' }}>Loading…</div>;

  const charts = buildTenantCharts(data.stats);

  return (
    <div>
      <TenantHeader tenant={data.tenant} yearRange={data.stats.yearRange} />
      <div className="page">
        <SummaryCards summary={data.stats.summary} />
        <div className="section" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
          {charts.map((chart, i) => (
            <div key={i} style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 4, padding: 16, minHeight: 400 }}>
              <GraphRender chart={chart} />
            </div>
          ))}
        </div>
        <div className="section">
          <h2>Collaboration Graph</h2>
          <TenantGraph nodes={data.graph.nodes} edges={data.graph.edges} />
        </div>
        <div className="section">
          <h2>Authors Directory</h2>
          <AuthorsTable authors={data.authors} />
        </div>
      </div>
    </div>
  );
}

const el = document.getElementById('tenant-root');
if (el) createRoot(el).render(<App />);
