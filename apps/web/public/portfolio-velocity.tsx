import React from 'react';
import { GraphRender } from '../ui/graph-engine/index';
import type { GraphDirective } from '../architect/graph-composer.types';

export type VelocityPoint = { year: number; total: number; projected?: number; partial?: boolean };
export type ForecastPoint = { year: number; total: number };
export type Velocity = {
  series: VelocityPoint[];
  forecast?: ForecastPoint[];
  score: number;
  trend: 'rising' | 'flat' | 'falling';
};

const TREND_SYMBOL: Record<Velocity['trend'], string> = { rising: '▲', flat: '→', falling: '▼' };
const TREND_COLOR: Record<Velocity['trend'], string> = { rising: 'var(--ok)', flat: 'var(--fg-dim)', falling: 'var(--err)' };

export interface VelocityLabels {
  score: string;
  trend: Record<Velocity['trend'], string>;
  actual: string;
  forecast: string;
}
const DEFAULT_LABELS: VelocityLabels = {
  score: 'score',
  trend: { rising: 'rising', flat: 'flat', falling: 'falling' },
  actual: 'Actual citations',
  forecast: 'Forecast',
};

const FIGURE: React.CSSProperties = { fontFamily: 'var(--display)', fontSize: 42, letterSpacing: '-0.02em', color: 'var(--accent)', lineHeight: 1 };
const CAPTION: React.CSSProperties = { fontSize: 10, textTransform: 'uppercase', color: 'var(--fg-dim)', letterSpacing: '0.12em', fontFamily: 'var(--mono)', marginTop: 4 };

// Citation velocity — one continuous line over publication years. Full years
// are `observed` (solid, filled); the still-filling current year is `partial`
// and forecast years are `projected` — the engine's status→style table dashes
// the tail. `valueLabels` prints each count above its point.
export function buildVelocityChart(v: Velocity, title: string): GraphDirective {
  const hist = v.series.map(p => ({
    label: String(p.year),
    value: p.partial && p.projected != null ? p.projected : p.total,
    status: p.partial ? ('partial' as const) : ('observed' as const),
  }));
  const fc = (v.forecast || []).map(p => ({
    label: String(p.year),
    value: p.total,
    status: 'projected' as const,
  }));
  return {
    type: 'line',
    title,
    xLabel: 'Year',
    yLabel: 'Citations',
    valueLabels: true,
    data: [...hist, ...fc] as any,
  };
}

export function VelocityPanel({ velocity, labels = DEFAULT_LABELS }: { velocity: Velocity; labels?: VelocityLabels }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 4 }}>
        <div>
          <div style={FIGURE}>{velocity.score.toFixed(2)}</div>
          <div style={CAPTION}>{labels.score}</div>
        </div>
        <div style={{ color: TREND_COLOR[velocity.trend], fontSize: 16, fontFamily: 'var(--mono)' }}>
          {TREND_SYMBOL[velocity.trend]} {labels.trend[velocity.trend]}
        </div>
      </div>
      <GraphRender chart={buildVelocityChart(velocity, labels.actual)} />
    </div>
  );
}

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
