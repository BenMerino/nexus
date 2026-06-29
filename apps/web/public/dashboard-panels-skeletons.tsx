import React from 'react';
import { SectionHead, Tag, Skeleton } from './ui-kit';

/* Loading states for the SERVER-COMPOSED dashboard panels (top journals,
 * partner institutions, publications-per-year). These have no client component
 * to co-locate with — the panel is rendered server-side via the recompose
 * system — so the skeleton is the only client artifact, kept here. Each ghosts
 * its real shape with the Skeleton primitive (single shimmer source).
 * RecentlyIndexed's skeleton lives WITH its component (dashboard-panels.tsx). */

const JOURNAL_NAMES = [
  'Revista Médica de Chile', 'PLOS ONE', 'Scientific Reports',
  'Nature Communications', 'Latin American Research Review',
];
const PARTNER_NAMES = [
  'Universidad de Chile', 'Pontificia Universidad Católica',
  'Universidad Austral de Chile', 'Universidad de Concepción',
  'Universidad Diego Portales', 'Universidad de Santiago',
];

function RankedListSkel({ titles, counts }: { titles: string[]; counts: string[] }) {
  return (
    <ul className="ranked-list">
      {titles.map((title, i) => (
        <li key={i}>
          <span className="rank">{String(i + 1).padStart(2, '0')}</span>
          <span className="rank-label"><Skeleton as="span" className="rank-title">{title}</Skeleton></span>
          <Skeleton as="span" className="rank-count">{counts[i % counts.length]}</Skeleton>
        </li>
      ))}
    </ul>
  );
}

export function TopJournalsSkeleton() {
  return (
    <section className="card">
      <SectionHead eyebrow="Venues" title="Top journals" />
      <RankedListSkel titles={JOURNAL_NAMES} counts={['28', '24', '22', '20', '18']} />
    </section>
  );
}

export function PartnerInstitutionsSkeleton() {
  return (
    <section className="card">
      <SectionHead eyebrow="Collaborations" title="Partner institutions" />
      <RankedListSkel titles={PARTNER_NAMES} counts={['28', '24', '22', '20', '18', '16']} />
    </section>
  );
}

export function BarChartSkeleton() {
  const heights = [55, 72, 48, 88, 64, 78];
  const years = ['2020', '2021', '2022', '2023', '2024', '2025'];
  return (
    <section className="card card-chart">
      <SectionHead eyebrow="Output" title="Publications per year" right={<Tag mono tone="muted">2020–2025</Tag>} />
      <div className="bar-chart">
        {heights.map((h, i) => (
          <div key={i} className="bar-col">
            <div className="bar-wrap"><Skeleton block className="bar" height={`${h}%`} /></div>
            <Skeleton as="div" className="bar-label">{years[i]}</Skeleton>
          </div>
        ))}
      </div>
    </section>
  );
}
