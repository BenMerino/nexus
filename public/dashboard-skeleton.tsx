import React from 'react';

function StatSkel() {
  return (
    <div className="stat">
      <div className="stat-label"><span className="skel skel-text" style={{ width: '55%' }}>x</span></div>
      <div className="stat-value"><span className="skel skel-num">x</span></div>
      <div className="stat-sub"><span className="skel skel-text" style={{ width: '70%' }}>x</span></div>
    </div>
  );
}

function SectionHeadSkel({ eyebrowWidth = 90, titleWidth = 220 }: { eyebrowWidth?: number; titleWidth?: number }) {
  return (
    <div className="section-head">
      <div style={{ width: '100%' }}>
        <div className="eyebrow"><span className="skel skel-text" style={{ width: eyebrowWidth }}>x</span></div>
        <span className="skel skel-title" style={{ width: titleWidth }}>x</span>
      </div>
    </div>
  );
}

function BarChartSkel() {
  const heights = [55, 72, 48, 88, 64, 78];
  return (
    <section className="card card-chart">
      <SectionHeadSkel titleWidth={240} />
      <div className="bar-chart">
        {heights.map((h, i) => (
          <div key={i} className="bar-col">
            <div className="bar-wrap">
              <span className="skel" style={{ width: '100%', height: `${h}%`, alignSelf: 'flex-end', borderRadius: '1px 1px 0 0' }}>x</span>
            </div>
            <div className="bar-label"><span className="skel skel-text" style={{ width: 28 }}>x</span></div>
          </div>
        ))}
      </div>
    </section>
  );
}

function GraphPreviewSkel() {
  return (
    <section className="card card-graph-preview" style={{ display: 'flex', gap: 18, alignItems: 'stretch' }}>
      <aside style={{ width: 180, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div className="eyebrow"><span className="skel skel-text" style={{ width: 60 }}>x</span></div>
          <span className="skel skel-title" style={{ width: 140 }}>x</span>
        </div>
        <span className="skel skel-text" style={{ width: 110 }}>x</span>
      </aside>
      <div style={{ flex: 1, minHeight: 260, position: 'relative' }}>
        <span className="skel skel-block" style={{ position: 'absolute', inset: 0 }}>x</span>
      </div>
    </section>
  );
}

function RankedListSkel({ rows = 5, eyebrowWidth = 70, titleWidth = 180 }: { rows?: number; eyebrowWidth?: number; titleWidth?: number }) {
  return (
    <section className="card">
      <SectionHeadSkel eyebrowWidth={eyebrowWidth} titleWidth={titleWidth} />
      <ul className="ranked-list" style={{ listStyle: 'none' }}>
        {Array.from({ length: rows }).map((_, i) => (
          <li key={i} className="skel-row">
            <span className="skel skel-text" style={{ width: 22 }}>x</span>
            <span className="skel skel-text" style={{ width: '70%' }}>x</span>
            <span className="skel skel-text" style={{ width: 32 }}>x</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TableSkel({ rows = 5 }: { rows?: number }) {
  return (
    <section className="card card-span-2">
      <SectionHeadSkel eyebrowWidth={70} titleWidth={200} />
      <table className="paper-table">
        <thead><tr>
          {['45%', '10%', '20%', '12%', '8%'].map((w, i) => (
            <th key={i}><span className="skel skel-text" style={{ width: w }}>x</span></th>
          ))}
        </tr></thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i}>
              <td><span className="skel skel-text" style={{ width: '85%' }}>x</span></td>
              <td><span className="skel skel-text" style={{ width: '60%' }}>x</span></td>
              <td><span className="skel skel-text" style={{ width: '70%' }}>x</span></td>
              <td><span className="skel skel-text" style={{ width: '50%' }}>x</span></td>
              <td><span className="skel skel-text" style={{ width: '40%' }}>x</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="view dashboard" aria-busy="true" aria-live="polite">
      <header className="view-head">
        <div style={{ flex: 1 }}>
          <div className="eyebrow"><span className="skel skel-text" style={{ width: 140 }}>x</span></div>
          <span className="skel skel-title" style={{ width: 360, height: '2.6em' }}>x</span>
          <div style={{ marginTop: 10 }}><span className="skel skel-text" style={{ width: 280 }}>x</span></div>
        </div>
        <div className="view-meta" style={{ display: 'flex', gap: 8 }}>
          <span className="skel skel-text" style={{ width: 110, height: 22 }}>x</span>
          <span className="skel skel-text" style={{ width: 220, height: 22 }}>x</span>
        </div>
      </header>

      <div className="stat-row">
        <StatSkel /><StatSkel /><StatSkel /><StatSkel />
      </div>

      <div className="dash-grid">
        <BarChartSkel />
        <GraphPreviewSkel />
        <RankedListSkel eyebrowWidth={60} titleWidth={140} />
        <RankedListSkel eyebrowWidth={110} titleWidth={200} />
        <TableSkel />
      </div>
    </div>
  );
}
