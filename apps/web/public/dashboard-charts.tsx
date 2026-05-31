import React, { useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useCurrentUser } from './shell-helpers';
import { Stat, SectionHead } from './ui-primitives';
import type { DashboardData } from './dashboard-builders';
import { yearlyCounts, BarChart, TopJournals, PartnerInstitutions, RecentlyIndexed } from './dashboard-panels';
import { ClaimPaperPanel } from './claim-paper-panel';
import { CoAuthorGraphPanel } from './coauthor-graph-preview';
import { VelocityPanel } from './portfolio-velocity';
import { CadencePanel } from './portfolio-cadence';
import { TopCitedPanel } from './portfolio-topcited';
import { ConceptsPanel } from './portfolio-concepts';
import { DashboardLoading } from './dashboard-loading';
import { HIndexBreakdown } from './h-index-breakdown';
import { ProjectsGanttPanel } from './projects-gantt';

function DashboardContent({ data }: { data: DashboardData }) {
  const { me } = useCurrentUser();
  const viewed = data.viewedUser || null;
  const years = yearlyCounts(data);
  const tenantName = me?.tenant || 'Institution';
  const subject = viewed
    ? { profile: viewed.profile, user: viewed.user, hIndex: viewed.hIndex, hIndexByType: viewed.hIndexByType }
    : { profile: me?.profile, user: me?.user, hIndex: me?.hIndex ?? null, hIndexByType: me?.hIndexByType ?? null };
  const displayName = subject.profile?.researcherName || subject.profile?.name || subject.user || '';
  const isPersonal = !!subject.profile?.orcid;
  const subjectOrcid = subject.profile?.orcid || null;
  const isOwnDashboard = !viewed;

  const p = data.portfolio;
  const pubCount = p?.works.length ?? data.totalPubs;
  const totalCit = p ? p.works.reduce((s, w) => s + (w.citation_count || 0), 0) : data.totalCitations;
  const collabCount = p ? p.collaborators.existing.length : data.authorCount;

  const heroStats = isPersonal ? [
    { label: 'Publications',   value: pubCount.toLocaleString(), sub: 'indexed via ORCID' },
    { label: 'Total citations', value: totalCit.toLocaleString(), sub: 'OpenAlex · last sync' },
    { label: 'h-index',        value: subject.hIndex ?? '—', sub: <HIndexBreakdown byType={subject.hIndexByType} />, accent: true },
    { label: 'Collaborators',  value: collabCount.toLocaleString(), sub: 'unique, all years' },
  ] : [
    { label: 'Publications',    value: data.totalPubs.toLocaleString(), sub: 'indexed records' },
    { label: 'Citations',       value: data.totalCitations.toLocaleString(), sub: 'sum across papers' },
    { label: 'Open access',     value: data.totalPubs > 0 ? `${Math.round((data.oaCount / data.totalPubs) * 100)}%` : '—', sub: 'of total output', accent: true },
    { label: 'Authors indexed', value: data.authorCount.toLocaleString(), sub: 'ORCID-verified' },
  ];

  const title = isPersonal && displayName
    ? <><em>{displayName}</em></>
    : <><em>{tenantName}</em></>;

  return (
    <div className="view dashboard">
      <header className="view-head">
        <div>
          <h1 className="view-title">{title}</h1>
        </div>
      </header>

      <div className="stat-row">
        {heroStats.map((s, i) => <Stat key={i} {...s} />)}
      </div>

      <div className="dash-grid">
        {isPersonal && p ? (
          <>
            <section className="card card-chart">
              <SectionHead title="Citation velocity" />
              <VelocityPanel velocity={p.velocity} />
            </section>
            <section className="card card-chart">
              <SectionHead title="Publication cadence" />
              {p.cadence && <CadencePanel cadence={p.cadence} />}
            </section>
            <ProjectsGanttPanel filterOrcid={subjectOrcid} />
            <CoAuthorGraphPanel graph={p?.coauthorGraph} />
            <section className="card">
              <SectionHead eyebrow="Impact" title="Most cited" />
              <TopCitedPanel items={p.topCited || []} />
            </section>
            <section className="card">
              <SectionHead eyebrow="Field" title="What you're known for" />
              <ConceptsPanel concepts={p.concepts || []} />
            </section>
            <TopJournals data={data} />
            <PartnerInstitutions data={data} />
            {isOwnDashboard && <ClaimPaperPanel onClaimed={() => window.location.reload()} />}
          </>
        ) : (
          <>
            {years.length > 0 ? <BarChart rows={years} title="Publications per year" /> : <div className="card card-chart"><div className="muted">No year data.</div></div>}
            <CoAuthorGraphPanel graph={p?.coauthorGraph} />
            <TopJournals data={data} />
            <PartnerInstitutions data={data} />
            <ProjectsGanttPanel />
            <RecentlyIndexed data={data} />
          </>
        )}
      </div>
      <div id="import-slot" />
    </div>
  );
}

function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const viewOrcid = new URLSearchParams(window.location.search).get('orcid');
    const url = viewOrcid
      ? `/api/dashboard?action=stats&orcid=${encodeURIComponent(viewOrcid)}`
      : '/api/dashboard?action=stats';
    fetch(url)
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(setData)
      .catch(e => setErr(String(e)));
  }, []);
  return (
    <>
      {err && <div className="view"><div className="status error">Error: {err}</div></div>}
      {!data && !err && <DashboardLoading />}
      {data && <DashboardContent data={data} />}
    </>
  );
}

let root: Root | null = null;
function mount() {
  const el = document.getElementById('dashboard-root');
  if (!el) return;
  if (root) root.unmount();
  root = createRoot(el);
  root.render(<App />);
}
(window as any).__nexusMounts = (window as any).__nexusMounts || {};
(window as any).__nexusMounts[new URL(import.meta.url).pathname] = mount;
mount();
