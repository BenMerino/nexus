import React, { useEffect, useRef, useState } from 'react';

// KPI micro-sparklines — a real per-year trend drawn as a tiny static SVG.
// Lightweight by construction: NO engine, NO slider, NO toggles, no hover —
// just paths. The series comes from the server (publications.kpiSparks,
// unit-scoped) with a per-point `status`: 'observed' (solid), 'partial'/
// 'projected' (the still-filling year + regression forecast → DASHED, with the
// gradient continuing underneath — mirroring the citation-velocity panel).
// The open-access ring is the one non-series glyph (it encodes a single pct).

export type SparkStatus = 'observed' | 'partial' | 'projected';
export type SparkPoint = { year: number; value: number; status?: SparkStatus };

// Series glyphs (area/bars) fill their card as a bottom strip: the SVG is
// computed at the strip's MEASURED pixel width (not stretched via
// preserveAspectRatio, which would distort strokes and the end dot). H is the
// strip height; W below is only the pre-measure fallback.
const W = 104, H = 44;

function useMeasuredWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

// Downsample a series into at most `bins` evenly-sized buckets (sum per bucket),
// so a long span (utalca ~106y) renders readable, not sub-pixel. Only OBSERVED
// points are bucketed; the partial+projected tail (a few points) passes through
// so the dashed boundary stays intact. Fewer points than bins pass unchanged.
function bucketize(series: SparkPoint[], bins: number): SparkPoint[] {
  const obs = series.filter(p => (p.status ?? 'observed') === 'observed');
  const tail = series.filter(p => (p.status ?? 'observed') !== 'observed');
  if (obs.length <= bins) return series;
  const size = obs.length / bins;
  const out: SparkPoint[] = [];
  for (let b = 0; b < bins; b++) {
    const slice = obs.slice(Math.floor(b * size), Math.floor((b + 1) * size));
    if (!slice.length) continue;
    // AVERAGE per year, not sum — these are per-year metrics, and the projected
    // tail is single-year. Summing made each observed bucket tower over the
    // single-year forecast, so the line cratered into the projection (a false
    // drop). Averaging keeps observed and projected on the same per-year scale.
    const avg = slice.reduce((s, p) => s + p.value, 0) / slice.length;
    out.push({ year: slice[slice.length - 1].year, value: avg, status: 'observed' });
  }
  return [...out, ...tail];
}

// Map a series to plotting points sharing one value-scale (so solid + dashed
// segments align). Returns null for <2 points.
function project(series: SparkPoint[], w: number): { x: number; y: number; status: SparkStatus }[] | null {
  if (series.length < 2) return null;
  const vals = series.map(s => s.value);
  const max = Math.max(...vals), min = Math.min(...vals), rng = max - min || 1;
  return series.map((s, i) => ({
    x: i / (series.length - 1) * w,
    y: H - 2 - ((s.value - min) / rng) * (H - 6),
    status: s.status ?? 'observed',
  }));
}

const path = (p: { x: number; y: number }[]) =>
  'M' + p.map(q => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' L');

function Area({ accent, series, w }: { accent: string; series: SparkPoint[]; w: number }) {
  // Bucket count scales with the strip width so bars/vertices stay readable
  // at any card size (~6px per bucket, floor at the old micro density).
  const p = project(bucketize(series, Math.max(40, Math.round(w / 6))), w);
  if (!p) return <svg className="kpi-spark" width={w} height={H} aria-hidden="true" />;
  // Split at the first non-observed point; the dashed segment starts one point
  // earlier so it connects to the solid line (shared boundary vertex).
  const cut = p.findIndex(q => q.status !== 'observed');
  const solid = cut === -1 ? p : p.slice(0, cut);
  const dashed = cut === -1 ? [] : p.slice(Math.max(0, cut - 1));
  const area = `${path(p)} L${w},${H} L0,${H} Z`;
  const last = p[p.length - 1];
  return (
    <svg className="kpi-spark" width={w} height={H} viewBox={`0 0 ${w} ${H}`} fill="none" aria-hidden="true">
      <path d={area} fill={accent} fillOpacity="0.14" />
      {solid.length >= 2 ? <path d={path(solid)} stroke={accent} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" /> : null}
      {dashed.length >= 2 ? <path d={path(dashed)} stroke={accent} strokeWidth="1.6" strokeDasharray="2.4 2.2" strokeLinejoin="round" strokeLinecap="round" opacity="0.85" /> : null}
      <circle cx={last.x.toFixed(1)} cy={last.y.toFixed(1)} r="2.2" fill={accent} opacity={last.status === 'observed' ? 1 : 0.6} />
    </svg>
  );
}

function Bars({ accent, series: raw, w }: { accent: string; series: SparkPoint[]; w: number }) {
  const series = bucketize(raw, Math.max(16, Math.round(w / 14)));
  const n = series.length;
  if (n < 2) return <svg className="kpi-spark" width={w} height={H} aria-hidden="true" />;
  const gap = w / n, bw = gap * 0.62, max = Math.max(...series.map(s => s.value)) || 1;
  return (
    <svg className="kpi-spark" width={w} height={H} viewBox={`0 0 ${w} ${H}`} aria-hidden="true">
      {series.map((s, i) => {
        const bh = Math.max(2, (s.value / max) * (H - 4));
        // Projected/partial bars are solid but faded — a lower-opacity bar reads
        // as "forecast" without the noise of a dashed outline at this size.
        const projected = (s.status ?? 'observed') !== 'observed';
        const x = (i * gap + (gap - bw) / 2).toFixed(1);
        const opacity = projected ? 0.3 : (0.45 + 0.55 * (i / (n - 1)));
        return <rect key={i} x={x} y={(H - bh).toFixed(1)} width={bw.toFixed(1)} height={bh.toFixed(1)} fill={accent} opacity={opacity.toFixed(2)} />;
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
  // Series glyphs render inside the full-width strip even for ring cards'
  // siblings — hooks must run unconditionally, so measure before branching.
  const [stripRef, w] = useMeasuredWidth();
  if (kind === 'ring') return <Ring accent={accent} pct={pct ?? 0} />;
  // Drop the 'partial' (still-filling current year) point: at micro size its
  // half-empty value plots as a sharp false cliff between observed and the
  // forecast, reading as a decline that isn't real. Without it the glyph goes
  // observed → projected smoothly. (The composer still emits it; the full
  // velocity panel keeps it, where labels/hover make the dip legible.)
  const plotted = (series ?? []).filter(p => (p.status ?? 'observed') !== 'partial');
  const width = w || W;
  return (
    <div className="kpi-spark-strip" ref={stripRef}>
      {kind === 'bars'
        ? <Bars accent={accent} series={plotted} w={width} />
        : <Area accent={accent} series={plotted} w={width} />}
    </div>
  );
}
