import React, { useState } from 'react';

/* DEV/PREVIEW gradient-ramp builder — for dialing in the sky's night gradient
 * stops (currently: black top / purple mid / red horizon, see sky-palette.ts
 * + sky-bg.ts). Purely a visual tool: drag the color + position controls,
 * read the generated CSS linear-gradient string back to hand to Claude.
 * Lives only on /dna.html. No wiring into sky-bg.ts — this is a scratch pad,
 * not a live control. */

type RGB = [number, number, number];
const toCss = (c: RGB) => `rgb(${c[0]},${c[1]},${c[2]})`;
const toHex = (c: RGB) => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
const fromHex = (h: string): RGB => [
  parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16),
];

interface Stop { pos: number; color: RGB; label: string; }

const INITIAL: Stop[] = [
  { pos: 0,  color: [0, 0, 0],       label: 'top (black)' },
  { pos: 10, color: [0, 0, 0],       label: 'black end' },
  { pos: 10, color: [40, 26, 66],    label: 'purple start' },
  { pos: 95, color: [40, 26, 66],    label: 'purple end' },
  { pos: 100, color: [175, 32, 44],  label: 'hor (red)' },
];

export function GradientBuilder() {
  const [stops, setStops] = useState<Stop[]>(INITIAL);

  const setPos = (i: number, pos: number) =>
    setStops(s => s.map((st, j) => (j === i ? { ...st, pos } : st)));
  const setColor = (i: number, color: RGB) =>
    setStops(s => s.map((st, j) => (j === i ? { ...st, color } : st)));

  const cssStops = stops
    .slice().sort((a, b) => a.pos - b.pos)
    .map(s => `${toCss(s.color)} ${s.pos}%`)
    .join(', ');
  const gradientCss = `linear-gradient(to bottom, ${cssStops})`;

  return (
    <div style={{
      position: 'fixed', left: 16, right: 16, top: 16, zIndex: 60,
      padding: '14px 18px', borderRadius: 'var(--radius-card)',
      background: 'var(--glass-2)', backdropFilter: 'blur(var(--glass-blur))',
      border: 'var(--border-w) solid var(--border)', maxWidth: 900, margin: '0 auto',
      fontFamily: 'var(--font-mono)', fontSize: 'var(--text-detail)',
    }}>
      <div style={{
        height: 120, borderRadius: 'var(--radius-control)', marginBottom: 12,
        background: gradientCss, border: 'var(--border-w) solid var(--border)',
      }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {stops.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 100, flex: 'none', opacity: 0.7 }}>{s.label}</span>
            <input type="color" value={toHex(s.color)}
              onChange={e => setColor(i, fromHex(e.target.value))}
              style={{ width: 32, height: 24, flex: 'none', cursor: 'pointer' }} />
            <input type="range" min={0} max={100} step={1} value={s.pos}
              onChange={e => setPos(i, Number(e.target.value))}
              style={{ flex: 1, accentColor: 'var(--accent)' }} />
            <span style={{ width: 40, flex: 'none', textAlign: 'right', opacity: 0.6 }}>{s.pos}%</span>
            <span style={{ width: 130, flex: 'none', opacity: 0.6 }}>{toCss(s.color)}</span>
          </div>
        ))}
      </div>
      <div style={{
        marginTop: 12, padding: 10, borderRadius: 'var(--radius-control)',
        background: 'var(--bg-inset)', wordBreak: 'break-all', userSelect: 'all',
      }}>
        {gradientCss}
      </div>
    </div>
  );
}
