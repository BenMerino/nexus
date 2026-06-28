import React from 'react';
import { useCurrentUser } from './shell-helpers';
import { StatSkeleton, SectionHead } from './ui-kit';
import { TopJournalsSkeleton, PartnerInstitutionsSkeleton, BarChartSkeleton, RecentlyIndexedSkeleton } from './dashboard-panels-skeletons';
import { CoAuthorGraphPanelSkeleton } from './coauthor-graph-preview';
import { VelocityPanelSkeleton } from './portfolio-velocity';
import { CadencePanelSkeleton } from './portfolio-cadence';
import { TopCitedPanelSkeleton } from './portfolio-topcited';
import { ConceptsPanelSkeleton } from './portfolio-concepts';

const PERSONAL_STATS = [
  { label: 'Publications',    sub: 'indexed via ORCID' },
  { label: 'Total citations', sub: 'OpenAlex · last sync' },
  { label: 'h-index',         sub: 'computed · real-time' },
  { label: 'Collaborators',   sub: 'unique, all years' },
];
const INSTITUTIONAL_STATS = [
  { label: 'Publications',    sub: 'indexed records' },
  { label: 'Citations',       sub: 'sum across papers' },
  { label: 'Open access',     sub: 'of total output' },
  { label: 'Authors indexed', sub: 'ORCID-verified' },
];

export function DashboardLoading() {
  const { me } = useCurrentUser();
  const viewingOther = typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('orcid');
  const tenantName = me?.tenant || 'Institution';
  const displayName = viewingOther ? '' : (me?.profile.researcherName || me?.profile.name || me?.user || '');
  const isPersonal = viewingOther || !!me?.profile.orcid;

  const stats = isPersonal ? PERSONAL_STATS : INSTITUTIONAL_STATS;

  const title = isPersonal && displayName
    ? <><em>{displayName}</em></>
    : isPersonal
      ? <><em>Loading…</em></>
      : <><em>{tenantName}</em></>;
  return (
    <div className="view dashboard" aria-busy="true" aria-live="polite">
      <header className="view-head">
        <div>
          <h1 className="view-title">{title}</h1>
        </div>
      </header>

      <div className="stat-row">
        {stats.map((s, i) => <StatSkeleton key={i} label={s.label} sub={s.sub} />)}
      </div>

      <div className="dash-grid">
        {isPersonal ? <PersonalCards /> : <InstitutionalCards />}
      </div>
    </div>
  );
}

function PersonalCards() {
  return (
    <>
      <section className="card card-chart">
        <SectionHead title="Citation velocity" />
        <VelocityPanelSkeleton />
      </section>
      <section className="card card-chart">
        <SectionHead title="Publication cadence" />
        <CadencePanelSkeleton />
      </section>
      <CoAuthorGraphPanelSkeleton />
      <section className="card">
        <SectionHead eyebrow="Impact" title="Most cited" />
        <TopCitedPanelSkeleton />
      </section>
      <section className="card">
        <SectionHead eyebrow="Field" title="What you're known for" />
        <ConceptsPanelSkeleton />
      </section>
      <TopJournalsSkeleton />
      <PartnerInstitutionsSkeleton />
    </>
  );
}

function InstitutionalCards() {
  return (
    <>
      <BarChartSkeleton />
      <CoAuthorGraphPanelSkeleton />
      <TopJournalsSkeleton />
      <PartnerInstitutionsSkeleton />
      <RecentlyIndexedSkeleton />
    </>
  );
}
