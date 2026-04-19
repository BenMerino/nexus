import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Shell } from './shell';
import { useCurrentUser } from './shell-helpers';
import { Stat, Tag } from './ui-primitives';
import type { DashboardData } from './dashboard-builders.js';
import { yearlyCounts, greeting, BarChart, TopJournals, PartnerInstitutions, RecentlyIndexed } from './dashboard-panels';

function DashboardContent({ data }: { data: DashboardData }) {
  const { me } = useCurrentUser();
  const years = yearlyCounts(data);
  const tenantName = me?.tenant || 'Institution';
  const displayName = me?.profile.name || me?.user || '';
  const firstName = displayName.split(' ')[0];
  const isPersonal = !!me?.profile.orcid;

  const heroStats = isPersonal ? [
    { label: 'Publications', value: data.totalPubs.toLocaleString(), sub: 'indexed via ORCID' },
    { label: 'Citations',    value: data.totalCitations.toLocaleString(), sub: 'OpenAlex · last sync' },
    { label: 'h-index',      value: me?.hIndex ?? '—', sub: 'computed · real-time', accent: true },
    { label: 'Co-authors',   value: data.authorCount.toLocaleString(), sub: 'unique, all years' },
  ] : [
    { label: 'Publications',    value: data.totalPubs.toLocaleString(), sub: 'indexed records' },
    { label: 'Citations',       value: data.totalCitations.toLocaleString(), sub: 'sum across papers' },
    { label: 'Open access',     value: data.totalPubs > 0 ? `${Math.round((data.oaCount / data.totalPubs) * 100)}%` : '—', sub: 'of total output', accent: true },
    { label: 'Authors indexed', value: data.authorCount.toLocaleString(), sub: 'ORCID-verified' },
  ];

  const title = isPersonal && firstName
    ? <>{greeting()}, <em>{firstName}</em>.</>
    : <><em>{tenantName}</em>.</>;
  const sub = isPersonal
    ? `Your research, pulled from 4 scholarly sources. No forms.`
    : `A living map of ${tenantName}'s scholarly output.`;

  return (
    <div className="view dashboard">
      <header className="view-head">
        <div>
          <div className="eyebrow">{isPersonal ? 'Researcher' : 'Institutional overview'}</div>
          <h1 className="view-title">{title}</h1>
          <div className="view-sub">{sub}</div>
        </div>
        <div className="view-meta">
          <Tag mono>LAST SYNC · LIVE</Tag>
          <Tag mono tone="muted">OPENALEX · CROSSREF · S2 · DATACITE</Tag>
        </div>
      </header>

      <div className="stat-row">
        {heroStats.map((s, i) => <Stat key={i} {...s} />)}
      </div>

      <div className="dash-grid">
        {years.length > 0 ? <BarChart rows={years} title={isPersonal ? 'Your publications per year' : 'Publications per year'} /> : <div className="card card-chart"><div className="muted">No year data.</div></div>}
        <TopJournals data={data} />
        <PartnerInstitutions data={data} />
        <RecentlyIndexed data={data} />
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
