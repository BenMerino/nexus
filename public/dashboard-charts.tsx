import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { GraphRender } from '../graph-engine/index.js';
import { buildDashboardCharts } from './dashboard-builders.js';
import type { DashboardData } from './dashboard-builders.js';

function SummaryCards({ data }: { data: DashboardData }) {
  const cards = [
    { label: 'Publications', value: data.totalPubs },
    { label: 'Citations', value: data.totalCitations.toLocaleString() },
    { label: 'Open Access', value: data.oaCount },
    { label: 'Authors', value: data.authorCount },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '1.5rem' }}>
      {cards.map((c, i) => (
        <div key={i} style={{ background: '#f8f9fa', border: '1px solid #e0e0e0', borderRadius: '6px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: 'bold', fontFamily: 'monospace' }}>{c.value}</div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>{c.label}</div>
        </div>
      ))}
    </div>
  );
}

function SourceBreakdown({ data }: { data: DashboardData }) {
  const sourceCounts = new Map<string, number>();
  for (const row of data.yearSource) {
    const src = row.source || 'Other';
    sourceCounts.set(src, (sourceCounts.get(src) || 0) + parseInt(row.count));
  }
  const entries = [...sourceCounts.entries()].sort((a, b) => b[1] - a[1]);
  if (!entries.length) return null;
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <h3 style={{ fontFamily: 'monospace', fontSize: '14px', marginBottom: '8px' }}>By Source Index</h3>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {entries.map(([src, count]) => (
          <div key={src} style={{ background: '#fff', border: '1px solid #ddd', borderRadius: '4px', padding: '8px 14px', fontFamily: 'monospace', fontSize: '13px' }}>
            <strong>{src}</strong>: {count}
          </div>
        ))}
      </div>
    </div>
  );
}

function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard?action=stats')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: '2rem', fontFamily: 'monospace' }}>Loading dashboard...</div>;
  if (!data) return <div style={{ padding: '2rem', fontFamily: 'monospace' }}>Error loading data.</div>;

  const charts = buildDashboardCharts(data);

  return (
    <div>
      <SummaryCards data={data} />
      <SourceBreakdown data={data} />
      {charts.map((chart, i) => (
        <div key={i} style={{ marginBottom: '1rem' }}>
          <GraphRender chart={chart} />
        </div>
      ))}
    </div>
  );
}

const el = document.getElementById('dashboard-root');
if (el) createRoot(el).render(<App />);
