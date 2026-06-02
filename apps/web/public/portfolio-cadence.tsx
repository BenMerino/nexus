import React, { useMemo } from 'react';
import { DirectiveChart } from '../ui/graph-engine/index';
import type { GraphDirective } from '../architect/graph-composer.types';
import { TYPE_DISPLAY_LABELS } from './type-labels';
import { typeColor, typeRank } from './type-metals';

export type CadenceSegment = { type: string; count: number };
export type CadencePoint = { year: number; count: number; segments: CadenceSegment[] };
export type Cadence = { series: CadencePoint[]; types: string[]; meanPerYear: number };

const defaultTypeLabel = (t: string) => TYPE_DISPLAY_LABELS[t] || (t === 'unknown' ? 'Unknown' : t);

export interface CadenceLabels { avgPerYear: string; }
const DEFAULT_LABELS: CadenceLabels = { avgPerYear: 'papers / year (avg)' };

const FIGURE: React.CSSProperties = { fontFamily: 'var(--display)', fontSize: 42, letterSpacing: '-0.02em', color: 'var(--accent)', lineHeight: 1 };
const CAPTION: React.CSSProperties = { fontSize: 10, textTransform: 'uppercase', color: 'var(--fg-dim)', letterSpacing: '0.12em', fontFamily: 'var(--mono)', marginTop: 4 };

// Publication cadence — stacked bar by work type per year. Colors bind to the
// type IDENTITY via `seriesColorMap`; `series`/`legendOrder` sort by metal rank;
// the mean rides in as a threshold. Each point carries a flat `value` = year
// total so the engine's single-series value label prints the stack total.
export function buildCadenceChart(c: Cadence, title: string, typeLabel: (t: string) => string): GraphDirective {
  const ordered = [...c.types].sort((a, b) => typeRank(a) - typeRank(b));
  const data = c.series.map(p => {
    const row: Record<string, string | number> = { label: String(p.year), value: p.count };
    for (const seg of p.segments) row[seg.type] = seg.count;
    return row;
  });
  return {
    type: 'stacked-bar',
    title,
    xLabel: 'Year',
    yLabel: 'Papers',
    series: ordered,
    legendOrder: ordered,
    legendLabels: Object.fromEntries(ordered.map(t => [t, typeLabel(t)])),
    colorScheme: {
      sentiment: 'neutral',
      primary: typeColor(ordered[0] || 'unknown'),
      fill: typeColor(ordered[0] || 'unknown'),
      seriesColorMap: Object.fromEntries(ordered.map(t => [t, typeColor(t)])),
    },
    thresholds: [{ value: c.meanPerYear, label: c.meanPerYear.toFixed(1), color: 'var(--fg-dim)' }],
    valueLabels: true,
    data: data as any,
  };
}

export function CadencePanel({ cadence, labels = DEFAULT_LABELS, typeLabel = defaultTypeLabel }: {
  cadence: Cadence; labels?: CadenceLabels; typeLabel?: (t: string) => string;
}) {
  const seed = useMemo(
    () => buildCadenceChart(cadence, labels.avgPerYear, typeLabel),
    [cadence, labels.avgPerYear, typeLabel],
  );
  if (!cadence.series.length) {
    return <p style={{ color: 'var(--fg-muted)' }}>No publication years on record.</p>;
  }
  return (
    <div>
      <div style={{ marginBottom: 4 }}>
        <div style={FIGURE}>{cadence.meanPerYear.toFixed(1)}</div>
        <div style={CAPTION}>{labels.avgPerYear}</div>
      </div>
      <DirectiveChart seed={seed} />
    </div>
  );
}

export function CadencePanelSkeleton() {
  const legendPlaceholders = ['Article', 'Conference paper', 'Review', 'Book chapter'];
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <div className="skel" style={{ display: 'inline-block', ...FIGURE }}>0.0</div>
        <div style={CAPTION}>papers / year (avg)</div>
      </div>
      <div style={{ height: 140, position: 'relative' }}>
        <div className="skel-fill skel" style={{ opacity: 0.5 }} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', marginTop: 10, fontSize: 11 }}>
        {legendPlaceholders.map((label, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--fg-dim)' }}>
            <span style={{ width: 10, height: 10, background: 'var(--bg-inset)', borderRadius: 2, display: 'inline-block' }} />
            <span className="skel" style={{ display: 'inline-block' }}>{label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
