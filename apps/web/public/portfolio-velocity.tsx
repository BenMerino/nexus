import React, { useLayoutEffect, useRef, useState } from 'react';

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
  actual: 'Citas reales',
  forecast: 'Proyección',
};

export function VelocityPanel({ velocity, labels = DEFAULT_LABELS }: { velocity: Velocity; labels?: VelocityLabels }) {
  const { series, forecast = [], score, trend } = velocity;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(460);
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const cw = entries[0].contentRect.width;
      if (cw > 0) setW(Math.floor(cw));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const histY = (p: VelocityPoint) => p.partial && p.projected != null ? p.projected : p.total;
  const allPoints = [...series.map(p => ({ year: p.year, y: histY(p), kind: 'hist' as const, partial: !!p.partial, raw: p.total })),
                     ...forecast.map(p => ({ year: p.year, y: p.total, kind: 'fc' as const, partial: false, raw: p.total }))];
  const max = Math.max(1, ...allPoints.map(p => p.y));
  const h = 140, pad = 28;
  const xs = allPoints.map(p => p.year);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const xScale = (y: number) => pad + (xs.length > 1 ? (y - minX) / (maxX - minX) * (w - pad * 2) : 0);
  const yScale = (v: number) => h - pad - (v / max) * (h - pad * 2);

  const histPts = allPoints.filter(p => p.kind === 'hist').map(p => [xScale(p.year), yScale(p.y)] as const);
  const histPath = histPts.map((pt, i) => (i === 0 ? 'M' : 'L') + pt[0] + ',' + pt[1]).join(' ');
  const lastFull = series.filter(p => !p.partial).slice(-1)[0];
  const bridgeStartX = lastFull ? xScale(lastFull.year) : histPts[histPts.length - 1][0];
  const bridgeStartY = lastFull ? yScale(histY(lastFull)) : histPts[histPts.length - 1][1];
  const fcSource = [
    ...series.filter(p => p.partial).map(p => ({ year: p.year, y: histY(p) })),
    ...forecast.map(p => ({ year: p.year, y: p.total })),
  ];
  const fcPath = `M${bridgeStartX},${bridgeStartY}` + fcSource.map(p => ` L${xScale(p.year)},${yScale(p.y)}`).join('');

  return (
    <div ref={wrapRef}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: 'var(--display)', fontSize: 42, letterSpacing: '-0.02em', color: 'var(--accent)', lineHeight: 1 }}>{score.toFixed(2)}</div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--fg-dim)', letterSpacing: '0.12em', fontFamily: 'var(--mono)', marginTop: 4 }}>{labels.score}</div>
        </div>
        <div style={{ color: TREND_COLOR[trend], fontSize: 16, fontFamily: 'var(--mono)' }}>
          {TREND_SYMBOL[trend]} {labels.trend[trend]}
        </div>
      </div>
      <svg width={w} height={h} style={{ display: 'block' }}>
        <path d={histPath} fill="none" stroke="var(--accent)" strokeWidth={2} />
        {fcSource.length > 0 && <path d={fcPath} fill="none" stroke="var(--accent)" strokeWidth={2} strokeDasharray="4 4" opacity={0.5} />}
        {allPoints.map((p, i) => {
          const cx = xScale(p.year), cy = yScale(p.y);
          const isForecast = p.kind === 'fc';
          const isPartial = p.partial;
          return (
            <g key={i}>
              <circle cx={cx} cy={cy} r={3} fill={isForecast || isPartial ? 'var(--bg-card)' : 'var(--accent)'} stroke="var(--accent)" strokeWidth={1.5} />
              <text x={cx} y={h - 6} fontSize={10} textAnchor="middle" fill="var(--fg-dim)" fontFamily="var(--mono)">{p.year}</text>
              <text x={cx} y={cy - 6} fontSize={10} textAnchor="middle" fill="var(--fg)" fontFamily="var(--mono)">{p.y}</text>
              {isPartial && <text x={cx} y={cy + 14} fontSize={8} textAnchor="middle" fill="var(--fg-dim)" fontFamily="var(--mono)">({p.raw} so far)</text>}
            </g>
          );
        })}
      </svg>
      <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 11, color: 'var(--fg-dim)', fontFamily: 'var(--mono)', letterSpacing: '0.04em' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <svg width={18} height={6}><line x1={0} y1={3} x2={18} y2={3} stroke="var(--accent)" strokeWidth={2} /></svg>
          {labels.actual}
        </span>
        {fcSource.length > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <svg width={18} height={6}><line x1={0} y1={3} x2={18} y2={3} stroke="var(--accent)" strokeWidth={2} strokeDasharray="3 3" opacity={0.6} /></svg>
            {labels.forecast}
          </span>
        )}
      </div>
    </div>
  );
}

export function VelocityPanelSkeleton() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 12 }}>
        <div>
          <div className="skel" style={{ display: 'inline-block', fontFamily: 'var(--display)', fontSize: 42, letterSpacing: '-0.02em', lineHeight: 1 }}>0.00</div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--fg-dim)', letterSpacing: '0.12em', fontFamily: 'var(--mono)', marginTop: 4 }}>score</div>
        </div>
        <div className="skel" style={{ display: 'inline-block', fontSize: 16, fontFamily: 'var(--mono)' }}>▲ rising</div>
      </div>
      <div style={{ height: 140, position: 'relative' }}>
        <div className="skel-fill skel" style={{ opacity: 0.5 }} />
      </div>
    </div>
  );
}
