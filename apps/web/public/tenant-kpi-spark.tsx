import React from 'react';

// KPI micro-sparklines — a real per-year trend drawn as a tiny static SVG.
// Lightweight by construction: NO engine, NO slider, NO toggles, no hover —
// just a path. The series comes from the server (publications.kpiSparks,
// unit-scoped), so each glyph reflects the actual trend behind its number.
// The open-access ring is the one non-series glyph (it encodes a single pct).

export type SparkPoint = { year: number; value: number };

// Normalize a per-year series to N plotting points (ascending). Empty/one-point
// series degrade to a flat baseline rather than throwing.
function pts(series: SparkPoint[], w: number, h: number) {
  const vals = series.map(s => s.value);
  if (vals.length < 2) return null;
  const max = Math.max(...vals), min = Math.min(...vals), rng = max - min || 1;
  return series.map((s, i) => [i / (series.length - 1) * w, h - 2 - ((s.value - min) / rng) * (h - 6)] as const);
}

function Area({ accent, series }: { accent: string; series: SparkPoint[] }) {
  const w = 104, h = 34;
  const p = pts(series, w, h);
  if (!p) return <svg className="kpi-spark" width={w} height={h} aria-hidden="true" />;
  const line = 'M' + p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L');
  const area = `${line} L${w},${h} L0,${h} Z`;
  const last = p[p.length - 1];
  return (
    <svg className="kpi-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" aria-hidden="true">
      <path d={area} fill={accent} fillOpacity="0.14" />
      <path d={line} stroke={accent} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0].toFixed(1)} cy={last[1].toFixed(1)} r="2.2" fill={accent} />
    </svg>
  );
}

function Bars({ accent, series }: { accent: string; series: SparkPoint[] }) {
  const w = 104, h = 34, n = series.length;
  if (n < 2) return <svg className="kpi-spark" width={w} height={h} aria-hidden="true" />;
  const gap = w / n, bw = gap * 0.62, max = Math.max(...series.map(s => s.value)) || 1;
  return (
    <svg className="kpi-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      {series.map((s, i) => {
        const bh = Math.max(2, (s.value / max) * (h - 4));
        return <rect key={i} x={(i * gap + (gap - bw) / 2).toFixed(1)} y={(h - bh).toFixed(1)} width={bw.toFixed(1)} height={bh.toFixed(1)} fill={accent} opacity={(0.45 + 0.55 * (i / (n - 1))).toFixed(2)} />;
      })}
    </svg>
  );
}

function Ring({ accent, pct }: { accent: string; pct: number }) {
  const sz = 44, r = 18, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
  return (
    <svg className="kpi-spark" width={sz} height={sz} viewBox={`0 0 ${sz} ${sz}`} aria-hidden="true">
      <circle cx={sz / 2} cy={sz / 2} r={r} fill="none" stroke="var(--bg-inset)" strokeWidth="5" />
      <circle cx={sz / 2} cy={sz / 2} r={r} fill="none" stroke={accent} strokeWidth="5"
              strokeDasharray={c.toFixed(1)} strokeDashoffset={off.toFixed(1)}
              strokeLinecap="round" transform={`rotate(-90 ${sz / 2} ${sz / 2})`} />
    </svg>
  );
}

export function KpiSpark({ kind, accent, series, pct }: { kind: 'area' | 'bars' | 'ring'; accent: string; series?: SparkPoint[]; pct?: number }) {
  if (kind === 'ring') return <Ring accent={accent} pct={pct ?? 0} />;
  if (kind === 'bars') return <Bars accent={accent} series={series ?? []} />;
  return <Area accent={accent} series={series ?? []} />;
}
