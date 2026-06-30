import React, { useState, useEffect } from 'react';
import {
  getSkyMode, setSkyMode, getManualMinutes, setManualMinutes, type SkyMode,
} from './sky/sky-mode';

/* DEV/PREVIEW sky scrub — a 4th 'manual' mode that pins an exact time of day so
 * you can drag through dawn→noon→dusk→night and watch every sun-driven token
 * (surfaces, charts, aurora, glass tint) update live. Lives only on /dna.html,
 * NOT the production header (which keeps live/day/night). Persists via sky-mode;
 * dispatches nexus:sky-mode so sky-bg repaints instantly. */

const MODES: { id: SkyMode; label: string }[] = [
  { id: 'live', label: 'Live' },
  { id: 'day', label: 'Day' },
  { id: 'night', label: 'Night' },
  { id: 'manual', label: 'Manual' },
];

const repaint = () => window.dispatchEvent(new CustomEvent('nexus:sky-mode'));
const fmt = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export function SkyScrub() {
  const [mode, setMode] = useState<SkyMode>(() => getSkyMode());
  const [min, setMin] = useState<number>(() => getManualMinutes());

  useEffect(() => { setSkyMode(mode); repaint(); }, [mode]);

  // sky-mode is shared across ALL pages — don't leak a dev 'manual'/forced scrub
  // to the real app. Restore 'live' when leaving /dna.html.
  useEffect(() => () => { setSkyMode('live'); repaint(); }, []);

  const onScrub = (v: number) => {
    setMin(v);
    setManualMinutes(v);
    if (mode !== 'manual') { setMode('manual'); }   // dragging enters manual
    else { setSkyMode('manual'); repaint(); }
  };

  return (
    <div style={{
      position: 'fixed', left: 16, right: 16, bottom: 16, zIndex: 50,
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '10px 16px', borderRadius: 'var(--radius-card)',
      background: 'var(--glass-2)', backdropFilter: 'blur(var(--glass-blur))',
      border: 'var(--border-w) solid var(--border)', maxWidth: 760, margin: '0 auto',
      fontFamily: 'var(--font-mono)', fontSize: 'var(--text-detail)',
    }}>
      <span style={{ opacity: 0.6, flex: 'none' }}>Sky</span>
      <div style={{ display: 'flex', gap: 4, flex: 'none' }}>
        {MODES.map(m => (
          <button key={m.id} onClick={() => setMode(m.id)}
            style={{
              padding: '4px 10px', borderRadius: 'var(--radius-control)', cursor: 'pointer',
              border: 'var(--border-w) solid var(--border)',
              background: mode === m.id ? 'var(--accent)' : 'transparent',
              color: mode === m.id ? 'var(--on-primary, #fff)' : 'var(--fg-muted)',
              font: 'inherit',
            }}>{m.label}</button>
        ))}
      </div>
      <input type="range" min={0} max={1439} step={1} value={min}
        disabled={mode !== 'manual'}
        onChange={e => onScrub(Number(e.target.value))}
        style={{ flex: 1, accentColor: 'var(--accent)', opacity: mode === 'manual' ? 1 : 0.4 }} />
      <span style={{ flex: 'none', minWidth: 44, textAlign: 'right',
        opacity: mode === 'manual' ? 1 : 0.4, fontVariantNumeric: 'tabular-nums' }}>
        {fmt(min)}
      </span>
    </div>
  );
}
