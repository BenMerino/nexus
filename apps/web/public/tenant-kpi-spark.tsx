import React from 'react';

// Decorative KPI flourishes. These are NOT data plots — they're a fixed,
// gently-rising motif that gives each card visual weight (the design's
// sparkline). Real series live in the engine charts below; nothing here
// claims to encode a value except the open-access ring, which reflects pct.

const RISE = [3, 5, 4, 7, 8, 7, 10, 12, 11, 14]; // shared abstract upward shape

function Area({ accent }: { accent: string }) {
  const w = 104, h = 34;
  const max = Math.max(...RISE), min = Math.min(...RISE), rng = max - min || 1;
  const pts = RISE.map((v, i) => [i / (RISE.length - 1) * w, h - 2 - ((v - min) / rng) * (h - 6)]);
  const line = 'M' + pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L');
  const area = `${line} L${w},${h} L0,${h} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg className="kpi-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" aria-hidden="true">
      <path d={area} fill={accent} fillOpacity="0.14" />
      <path d={line} stroke={accent} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0].toFixed(1)} cy={last[1].toFixed(1)} r="2.2" fill={accent} />
    </svg>
  );
}

function Bars({ accent }: { accent: string }) {
  const w = 104, h = 34, n = RISE.length, gap = w / n, bw = gap * 0.62, max = Math.max(...RISE);
  return (
    <svg className="kpi-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      {RISE.map((v, i) => {
        const bh = Math.max(2, (v / max) * (h - 4));
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

export function KpiSpark({ kind, accent, pct }: { kind: 'area' | 'bars' | 'ring'; accent: string; pct?: number }) {
  if (kind === 'ring') return <Ring accent={accent} pct={pct ?? 0} />;
  if (kind === 'bars') return <Bars accent={accent} />;
  return <Area accent={accent} />;
}
