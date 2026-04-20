import React from 'react';
import { SectionHead, Tag } from './ui-primitives';

function RankedListSkel({ rows, widths, counts }: { rows: number; widths: string[]; counts: number[] }) {
  return (
    <ul className="ranked-list">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i}>
          <span className="rank">{String(i + 1).padStart(2, '0')}</span>
          <span className="rank-label">
            <span className="rank-title"><span className="skel" style={{ display: 'inline-block', width: widths[i % widths.length], height: 14 }}>x</span></span>
          </span>
          <span className="rank-count"><span className="skel" style={{ display: 'inline-block', width: counts[i % counts.length], height: 14 }}>x</span></span>
        </li>
      ))}
    </ul>
  );
}

export function TopJournalsSkeleton() {
  return (
    <section className="card">
      <SectionHead eyebrow="Venues" title="Top journals" />
      <RankedListSkel rows={5} widths={['80%', '60%', '72%', '55%', '68%']} counts={[28, 24, 22, 20, 18]} />
    </section>
  );
}

export function PartnerInstitutionsSkeleton() {
  return (
    <section className="card">
      <SectionHead eyebrow="Collaborations" title="Partner institutions" />
      <RankedListSkel rows={6} widths={['78%', '65%', '70%', '52%', '60%', '58%']} counts={[28, 24, 22, 20, 18, 16]} />
    </section>
  );
}

export function BarChartSkeleton() {
  const heights = [55, 72, 48, 88, 64, 78];
  return (
    <section className="card card-chart">
      <SectionHead eyebrow="Output" title="Publications per year" right={<Tag mono tone="muted">—</Tag>} />
      <div className="bar-chart">
        {heights.map((h, i) => (
          <div key={i} className="bar-col">
            <div className="bar-wrap">
              <span className="skel" style={{ width: '100%', height: `${h}%`, alignSelf: 'flex-end', borderRadius: '1px 1px 0 0' }}>x</span>
            </div>
            <div className="bar-label"><span className="skel" style={{ display: 'inline-block', width: 28, height: 11 }}>x</span></div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function RecentlyIndexedSkeleton({ rows = 5 }: { rows?: number }) {
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
                <span className="skel" style={{ display: 'inline-block', width: '90%', height: 14 }}>x</span>
                <div style={{ marginTop: 3 }}>
                  <span className="skel" style={{ display: 'inline-block', width: 220, height: 11 }}>x</span>
                </div>
              </td>
              <td><span className="skel" style={{ display: 'inline-block', width: 56, height: 18 }}>x</span></td>
              <td><span className="skel" style={{ display: 'inline-block', width: '80%', height: 14 }}>x</span></td>
              <td><span className="skel" style={{ display: 'inline-block', width: 36, height: 14 }}>x</span></td>
              <td><span className="skel" style={{ display: 'inline-block', width: 28, height: 14 }}>x</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
