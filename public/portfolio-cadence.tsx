import React from 'react';

export type CadencePoint = { year: number; count: number };
export type Cadence = { series: CadencePoint[]; meanPerYear: number };

export function CadencePanel({ cadence }: { cadence: Cadence }) {
  const { series, meanPerYear } = cadence;
  if (!series.length) return <p style={{ color: 'var(--fg-muted)' }}>No publication years on record.</p>;
  const max = Math.max(1, ...series.map(p => p.count));
  const w = 460, h = 140, pad = 28;
  const barW = (w - pad * 2) / series.length * 0.7;
  const step = (w - pad * 2) / Math.max(1, series.length - 1);
  const xCenter = (i: number) => series.length === 1 ? w / 2 : pad + i * step;
  const yScale = (v: number) => h - pad - (v / max) * (h - pad * 2);
  const meanY = yScale(meanPerYear);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: 'var(--display)', fontSize: 42, letterSpacing: '-0.02em', color: 'var(--accent)', lineHeight: 1 }}>{meanPerYear.toFixed(1)}</div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--fg-dim)', letterSpacing: '0.12em', fontFamily: 'var(--mono)', marginTop: 4 }}>papers / year (avg)</div>
        </div>
      </div>
      <svg width={w} height={h} style={{ display: 'block', maxWidth: '100%' }}>
        <line x1={pad} x2={w - pad} y1={meanY} y2={meanY} stroke="var(--fg-dim)" strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
        {series.map((p, i) => {
          const cx = xCenter(i);
          const bh = (p.count / max) * (h - pad * 2);
          const bx = cx - barW / 2;
          const by = h - pad - bh;
          return (
            <g key={p.year}>
              <rect x={bx} y={by} width={barW} height={bh} fill="var(--accent)" opacity={0.85} rx={1.5} />
              <text x={cx} y={h - 6} fontSize={10} textAnchor="middle" fill="var(--fg-dim)" fontFamily="var(--mono)">{p.year}</text>
              {p.count > 0 && (
                <text x={cx} y={by - 4} fontSize={10} textAnchor="middle" fill="var(--fg)" fontFamily="var(--mono)">{p.count}</text>
              )}
            </g>
          );
        })}
      </svg>
      <div style={{ fontSize: 11, color: 'var(--fg-dim)', marginTop: 8 }}>
        Publications per year ({series[0].year}–{series[series.length - 1].year}). Dashed line: average.
      </div>
    </div>
  );
}
