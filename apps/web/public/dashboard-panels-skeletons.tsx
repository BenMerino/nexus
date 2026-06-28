import React from 'react';
import { SectionHead, Tag } from './ui-kit';

const JOURNAL_NAMES = [
  'Revista Médica de Chile',
  'PLOS ONE',
  'Scientific Reports',
  'Nature Communications',
  'Latin American Research Review',
];
const PARTNER_NAMES = [
  'Universidad de Chile',
  'Pontificia Universidad Católica',
  'Universidad Austral de Chile',
  'Universidad de Concepción',
  'Universidad Diego Portales',
  'Universidad de Santiago',
];

function RankedListSkel({ titles, counts }: { titles: string[]; counts: string[] }) {
  return (
    <ul className="ranked-list">
      {titles.map((title, i) => (
        <li key={i}>
          <span className="rank">{String(i + 1).padStart(2, '0')}</span>
          <span className="rank-label">
            <span className="rank-title skel">{title}</span>
          </span>
          <span className="rank-count skel">{counts[i % counts.length]}</span>
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
            <div className="bar-wrap">
              <div className="bar skel" style={{ height: `${h}%` }} />
            </div>
            <div className="bar-label skel">{years[i]}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function RecentlyIndexedSkeleton({ rows = 5 }: { rows?: number }) {
  const titles = [
    'A representative paper title for the recently indexed table layout',
    'Another placeholder title with a typical length',
    'A longer placeholder title that may wrap to two lines on narrow widths',
    'Short placeholder title',
    'Medium-length placeholder title for a recent paper',
  ];
  return (
    <section className="card card-span-2">
      <SectionHead eyebrow="Ledger" title="Recently indexed" />
      <table className="paper-table">
        <thead><tr>
          <th>Title</th><th>Type</th><th>Journal</th><th>Published</th><th>Cites</th>
        </tr></thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i}>
              <td className="paper-title">
                <span className="skel">{titles[i % titles.length]}</span>
                <div className="mono paper-doi"><span className="skel">10.0000/example.0000.000000</span></div>
              </td>
              <td><span className="tag type mono skel">Article</span></td>
              <td><span className="skel">Revista Médica de Chile</span></td>
              <td><span className="skel">2024</span></td>
              <td><span className="skel">000</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
