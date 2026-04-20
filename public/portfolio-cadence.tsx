import React, { useLayoutEffect, useRef, useState } from 'react';
import { TYPE_DISPLAY_LABELS } from './type-labels.js';
import { typeColor, typeRank, typeMetalName } from './type-metals.js';

export type CadenceSegment = { type: string; count: number };
export type CadencePoint = { year: number; count: number; segments: CadenceSegment[] };
export type Cadence = { series: CadencePoint[]; types: string[]; meanPerYear: number };

const typeLabel = (t: string) => TYPE_DISPLAY_LABELS[t] || (t === 'unknown' ? 'Unknown' : t);

export function CadencePanel({ cadence }: { cadence: Cadence }) {
  const { series, types, meanPerYear } = cadence;
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

  if (!series.length) {
    return <p style={{ color: 'var(--fg-muted)' }}>No publication years on record.</p>;
  }

  const max = Math.max(1, ...series.map(p => p.count));
  const h = 140;
  const pad = 28;
  const barW = (w - pad * 2) / series.length * 0.7;
  const step = (w - pad * 2) / Math.max(1, series.length - 1);
  const xCenter = (i: number) => series.length === 1 ? w / 2 : pad + i * step;
  const yScale = (v: number) => h - pad - (v / max) * (h - pad * 2);
  const meanY = yScale(meanPerYear);
  const baseY = h - pad;

  return (
    <div ref={wrapRef}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: 'var(--display)', fontSize: 42, letterSpacing: '-0.02em', color: 'var(--accent)', lineHeight: 1 }}>
            {meanPerYear.toFixed(1)}
          </div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--fg-dim)', letterSpacing: '0.12em', fontFamily: 'var(--mono)', marginTop: 4 }}>
            papers / year (avg)
          </div>
        </div>
      </div>

      <svg width={w} height={h} style={{ display: 'block' }}>
        <line x1={pad} x2={w - pad} y1={meanY} y2={meanY} stroke="var(--fg-dim)" strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />

        {series.map((p, i) => {
          const cx = xCenter(i);
          const totalH = (p.count / max) * (h - pad * 2);
          const bx = cx - barW / 2;
          let yCursor = baseY;

          return (
            <g key={p.year}>
              {p.segments.map(seg => {
                if (!seg.count) return null;
                const segH = (seg.count / max) * (h - pad * 2);
                yCursor -= segH;
                return (
                  <rect
                    key={seg.type}
                    x={bx}
                    y={yCursor}
                    width={barW}
                    height={segH}
                    fill={typeColor(seg.type)}
                    opacity={0.85}
                  >
                    <title>{`${p.year} · ${typeLabel(seg.type)}: ${seg.count}`}</title>
                  </rect>
                );
              })}
              <text x={cx} y={h - 6} fontSize={10} textAnchor="middle" fill="var(--fg-dim)" fontFamily="var(--mono)">
                {p.year}
              </text>
              {p.count > 0 && (
                <text x={cx} y={baseY - totalH - 4} fontSize={10} textAnchor="middle" fill="var(--fg)" fontFamily="var(--mono)">
                  {p.count}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', marginTop: 10, fontSize: 11 }}>
        {[...types].sort((a, b) => typeRank(a) - typeRank(b)).map(t => {
          const metal = typeMetalName(t);
          return (
            <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--fg-dim)' }}>
              <span style={{ width: 10, height: 10, background: typeColor(t), borderRadius: 2, display: 'inline-block' }} />
              {typeLabel(t)}{metal ? <span style={{ color: 'var(--fg-muted)', opacity: 0.7 }}> · {metal}</span> : null}
            </span>
          );
        })}
      </div>

      <div style={{ fontSize: 11, color: 'var(--fg-dim)', marginTop: 8 }}>
        Publications per year ({series[0].year}–{series[series.length - 1].year}), stacked by type. Dashed line: average.
      </div>
    </div>
  );
}

export function CadencePanelSkeleton() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: 'var(--display)', fontSize: 42, lineHeight: 1 }}>
            <span className="skel" style={{ display: 'inline-block', width: 80, height: '0.85em', verticalAlign: 'middle' }}>x</span>
          </div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--fg-dim)', letterSpacing: '0.12em', fontFamily: 'var(--mono)', marginTop: 4 }}>
            papers / year (avg)
          </div>
        </div>
      </div>
      <div style={{ height: 140, position: 'relative' }}>
        <span className="skel skel-block" style={{ position: 'absolute', inset: 0, opacity: 0.5 }}>x</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', marginTop: 10, fontSize: 11 }}>
        {[80, 100, 70, 90].map((wpx, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--fg-dim)' }}>
            <span style={{ width: 10, height: 10, background: 'var(--bg-inset)', borderRadius: 2, display: 'inline-block' }} />
            <span className="skel" style={{ display: 'inline-block', width: wpx, height: 11 }}>x</span>
          </span>
        ))}
      </div>
      <div style={{ fontSize: 11, color: 'var(--fg-dim)', marginTop: 8 }}>
        Publications per year, stacked by type. Dashed line: average.
      </div>
    </div>
  );
}
