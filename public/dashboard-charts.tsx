import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Shell } from './shell';
import { useCurrentUser } from './shell-helpers';
import { Stat, Tag } from './ui-primitives';
import { GraphRender } from '../graph-engine/index.js';
import { buildDashboardCharts, type DashboardData } from './dashboard-builders.js';
import { yearlyCounts, sourceBreakdown, BarChart, RankedInstitutions, RankedCountries, SourceList } from './dashboard-panels';

function DashboardContent({ data }: { data: DashboardData }) {
  const { me } = useCurrentUser();
  const oaPct = data.totalPubs > 0 ? Math.round((data.oaCount / data.totalPubs) * 100) : 0;
  const years = yearlyCounts(data);
  const sources = sourceBreakdown(data);
  const charts = buildDashboardCharts(data);

  const tenantName = me?.tenant || 'Institution';
  const displayName = me?.profile.name || me?.user || '';
  const firstName = displayName.split(' ')[0];

  const heroStats = [
    { label: 'Publications',    value: data.totalPubs.toLocaleString() },
    { label: 'Citations',       value: data.totalCitations.toLocaleString() },
    { label: 'Open access',     value: `${oaPct}%`, accent: true },
    { label: 'Authors indexed', value: data.authorCount.toLocaleString() },
  ];

  return (
    <div className="view dashboard">
      <header className="view-head">
        <div>
          <div className="eyebrow">Institutional overview</div>
          <h1 className="view-title">
            {firstName ? <>Good work, <em>{firstName}</em>.</> : <><em>{tenantName}</em>.</>}
          </h1>
          <div className="view-sub">A living map of {tenantName}&rsquo;s scholarly output — pulled from CrossRef, OpenAlex, Semantic Scholar, and DataCite.</div>
        </div>
        <div className="view-meta">
          <Tag mono>CROSSREF · OPENALEX · S2 · DATACITE</Tag>
          {me?.hIndex != null && <Tag mono tone="muted">H-INDEX · {me.hIndex}</Tag>}
        </div>
      </header>

      <div className="stat-row">
        {heroStats.map((s, i) => <Stat key={i} {...s} />)}
      </div>

      <div className="dash-grid">
        {years.length > 0 ? <BarChart rows={years} title="Publications per year" /> : <div className="card card-chart"><div className="muted">No year data.</div></div>}
        <RankedInstitutions data={data} />
        <RankedCountries data={data} />
        {sources.length > 0 && <SourceList sources={sources} />}
        {charts.slice(1).map((chart, i) => (
          <section key={i} className="card card-span-2"><GraphRender chart={chart} /></section>
        ))}
      </div>
      <div id="import-slot" />
    </div>
  );
}

function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/dashboard?action=stats')
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(setData)
      .catch(e => setErr(String(e)));
  }, []);
  return (
    <Shell scroll>
      {err && <div className="view"><div className="status error">Error: {err}</div></div>}
      {!data && !err && <div className="view"><div className="eyebrow">Loading dashboard…</div></div>}
      {data && <DashboardContent data={data} />}
    </Shell>
  );
}

const el = document.getElementById('dashboard-root');
if (el) createRoot(el).render(<App />);
