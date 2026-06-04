import React from 'react';

// Citation velocity types + loading skeleton. The chart itself is now SERVER-
// COMPOSED (publications.velocity): the public tenant page renders it via
// <RecomposeChart>, the dashboard via <ScopedChart> — no client-built
// directive lives here anymore (the old buildVelocityChart/VelocityPanel were
// the last N8 violator and are gone). These types still describe the velocity
// shape carried in the stats/portfolio payloads.
export type VelocityPoint = { year: number; total: number; projected?: number; partial?: boolean };
export type ForecastPoint = { year: number; total: number };
export type Velocity = {
  series: VelocityPoint[];
  forecast?: ForecastPoint[];
  score: number;
  trend: 'rising' | 'flat' | 'falling';
};

export interface VelocityLabels {
  score: string;
  trend: Record<Velocity['trend'], string>;
  actual: string;
  forecast: string;
}

const FIGURE: React.CSSProperties = { fontFamily: 'var(--display)', fontSize: 42, letterSpacing: '-0.02em', color: 'var(--accent)', lineHeight: 1 };
const CAPTION: React.CSSProperties = { fontSize: 10, textTransform: 'uppercase', color: 'var(--fg-dim)', letterSpacing: '0.12em', fontFamily: 'var(--mono)', marginTop: 4 };

export function VelocityPanelSkeleton() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 12 }}>
        <div>
          <div className="skel" style={{ display: 'inline-block', ...FIGURE }}>0.00</div>
          <div style={CAPTION}>score</div>
        </div>
        <div className="skel" style={{ display: 'inline-block', fontSize: 16, fontFamily: 'var(--mono)' }}>▲ rising</div>
      </div>
      <div style={{ height: 140, position: 'relative' }}>
        <div className="skel-fill skel" style={{ opacity: 0.5 }} />
      </div>
    </div>
  );
}
