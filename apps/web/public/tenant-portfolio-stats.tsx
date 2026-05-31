/* ── Portfolio stat readouts ─────────────────────────────────
 * The slim numeric headers above the public-profile velocity and
 * cadence charts — the score+trend and avg/year figures that used to
 * head the hand-rolled portfolio panels. The chart bodies are now
 * GraphRender; these keep the at-a-glance numbers above them.
 * ──────────────────────────────────────────────────────────── */

import React from 'react';
import type { Velocity } from './portfolio-velocity';
import { VELOCITY_LABELS_ES, CADENCE_LABELS_ES } from './tenant-i18n';

const TREND_SYMBOL: Record<Velocity['trend'], string> = { rising: '▲', flat: '→', falling: '▼' };
const TREND_COLOR: Record<Velocity['trend'], string> = { rising: 'var(--ok)', flat: 'var(--fg-dim)', falling: 'var(--err)' };

const FIGURE: React.CSSProperties = { fontFamily: 'var(--display)', fontSize: 42, letterSpacing: '-0.02em', color: 'var(--accent)', lineHeight: 1 };
const CAPTION: React.CSSProperties = { fontSize: 10, textTransform: 'uppercase', color: 'var(--fg-dim)', letterSpacing: '0.12em', fontFamily: 'var(--mono)', marginTop: 4 };

export function VelocityStat({ velocity }: { velocity: Velocity }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 4 }}>
      <div>
        <div style={FIGURE}>{velocity.score.toFixed(2)}</div>
        <div style={CAPTION}>{VELOCITY_LABELS_ES.score}</div>
      </div>
      <div style={{ color: TREND_COLOR[velocity.trend], fontSize: 16, fontFamily: 'var(--mono)' }}>
        {TREND_SYMBOL[velocity.trend]} {VELOCITY_LABELS_ES.trend[velocity.trend]}
      </div>
    </div>
  );
}

export function CadenceStat({ meanPerYear }: { meanPerYear: number }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={FIGURE}>{meanPerYear.toFixed(1)}</div>
      <div style={CAPTION}>{CADENCE_LABELS_ES.avgPerYear}</div>
    </div>
  );
}
