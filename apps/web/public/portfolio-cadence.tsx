import React from 'react';
import { RecomposeChart } from './recompose-chart';
import { TYPE_DISPLAY_LABELS } from './type-labels';

export type CadenceSegment = { type: string; count: number };
export type CadencePoint = { year: number; count: number; segments: CadenceSegment[] };
export type Cadence = { series: CadencePoint[]; types: string[]; meanPerYear: number };

const defaultTypeLabel = (t: string) => TYPE_DISPLAY_LABELS[t] || (t === 'unknown' ? 'Unknown' : t);

export interface CadenceLabels { avgPerYear: string; }
const DEFAULT_LABELS: CadenceLabels = { avgPerYear: 'papers / year (avg)' };

const FIGURE: React.CSSProperties = { fontFamily: 'var(--display)', fontSize: 42, letterSpacing: '-0.02em', color: 'var(--accent)', lineHeight: 1 };
const CAPTION: React.CSSProperties = { fontSize: 10, textTransform: 'uppercase', color: 'var(--fg-dim)', letterSpacing: '0.12em', fontFamily: 'var(--mono)', marginTop: 4 };

// Publication cadence — papers per period by work-type. The CHART directive is
// SERVER-COMPOSED (PublicationCharts.composeCadence → per-day ISO atoms), fetched
// by kind via RecomposeChart. The panel owns only the headline figure (mean per
// year, from stats); it no longer builds the chart, so it cannot down-sample the
// date into a year-collapsed (scanning) shape.
export function CadencePanel({ cadence, tenantId, labels = DEFAULT_LABELS, typeLabel = defaultTypeLabel }: {
  cadence: Cadence; tenantId?: number; labels?: CadenceLabels; typeLabel?: (t: string) => string;
}) {
  void typeLabel;
  if (!cadence.series.length) {
    return <p style={{ color: 'var(--fg-muted)' }}>No publication years on record.</p>;
  }
  return (
    <div>
      <div style={{ marginBottom: 4 }}>
        <div style={FIGURE}>{cadence.meanPerYear.toFixed(1)}</div>
        <div style={CAPTION}>{labels.avgPerYear}</div>
      </div>
      {/* Public tenant page passes tenantId → tenant-wide composed cadence.
          The authenticated researcher dashboard's per-ORCID cadence routes
          through the scoped /charts path (a follow-up); until then it shows
          only the headline figure. */}
      {tenantId != null
        ? <RecomposeChart kind="publications.cadence" tenantId={tenantId} />
        : null}
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
