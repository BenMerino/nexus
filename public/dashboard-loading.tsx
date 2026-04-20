import React from 'react';
import { useCurrentUser } from './shell-helpers';
import { StatSkeleton, Tag, SectionHead } from './ui-primitives';
import { greeting } from './dashboard-panels';
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
  const tenantName = me?.tenant || 'Institution';
  const displayName = me?.profile.name || me?.user || '';
  const firstName = displayName.split(' ')[0];
  const isPersonal = !!me?.profile.orcid;

  const stats = isPersonal ? PERSONAL_STATS : INSTITUTIONAL_STATS;

  const title = isPersonal && firstName
    ? <>{greeting()}, <em>{firstName}</em>.</>
    : <><em>{tenantName}</em>.</>;
  const sub = isPersonal
    ? `Your research, pulled from 4 scholarly sources. No forms.`
    : `A living map of ${tenantName}'s scholarly output.`;

  return (
    <div className="view dashboard" aria-busy="true" aria-live="polite">
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
        <SectionHead eyebrow="Trajectory" title="Citation velocity" />
        <VelocityPanelSkeleton />
      </section>
      <section className="card card-chart">
        <SectionHead eyebrow="Output" title="Publication cadence" />
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
