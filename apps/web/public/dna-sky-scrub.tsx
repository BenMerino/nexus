import React, { useState, useEffect } from 'react';
import { getSkyMode, setSkyMode, type SkyMode } from './sky/sky-mode';
import './dna-liquid';  // self-mounting: injects the liquid-glass SVG filter

/* DEV/PREVIEW sky toggle — day/night only (matches the production header).
 * Lives only on /dna.html. Persists via sky-mode; dispatches nexus:sky-mode
 * so sky-bg repaints instantly. */

const MODES: { id: SkyMode; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'night', label: 'Night' },
];

const repaint = () => window.dispatchEvent(new CustomEvent('nexus:sky-mode'));

export function SkyScrub() {
  const [mode, setMode] = useState<SkyMode>(() => getSkyMode());
  // Default OFF — borderless is now the platform default (--border-w: 0). The
  // toggle here lets you preview borders BACK on for comparison.
  const [borders, setBorders] = useState(false);
  // Liquid-glass is the platform default now (sky-bg sets data-liquid on every
  // page). The toggle defaults ON and lets you preview it OFF for comparison.
  const [liquid, setLiquid] = useState(true);

  useEffect(() => { setSkyMode(mode); repaint(); }, [mode]);

  useEffect(() => {
    const root = document.documentElement;
    if (liquid) root.setAttribute('data-liquid', '');
    else root.removeAttribute('data-liquid');
  }, [liquid]);

  // Borders preview: every border routes through --border-w. The platform
  // default is now 0 (borderless); "on" forces 1px back inline to compare,
  // "off" clears the override (→ the dna.css 0 default). Dev-only.
  useEffect(() => {
    const root = document.documentElement;
    if (borders) root.style.setProperty('--border-w', '1px');
    else root.style.removeProperty('--border-w');
  }, [borders]);

  // sky-mode is shared across ALL pages — don't leak the borderless override
  // to the real app. Restore on leaving /dna.html.
  useEffect(() => () => {
    document.documentElement.style.removeProperty('--border-w');
    document.documentElement.setAttribute('data-liquid', '');  // restore the platform default
  }, []);

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
      <button onClick={() => setBorders(b => !b)}
        title="Toggle all surface borders (--border-w)"
        style={{
          flex: 'none', padding: '4px 10px', borderRadius: 'var(--radius-control)',
          cursor: 'pointer', border: 'var(--border-w) solid var(--border)',
          background: borders ? 'transparent' : 'var(--accent)',
          color: borders ? 'var(--fg-muted)' : 'var(--on-primary, #fff)', font: 'inherit',
        }}>
        {borders ? 'Borders: on' : 'Borders: off'}
      </button>
      <button onClick={() => setLiquid(v => !v)}
        title="Liquid-glass DNA: SVG refraction on the glass surfaces (Chrome/Edge)"
        style={{
          flex: 'none', padding: '4px 10px', borderRadius: 'var(--radius-control)',
          cursor: 'pointer', border: 'var(--border-w) solid var(--border)',
          background: liquid ? 'var(--accent)' : 'transparent',
          color: liquid ? 'var(--on-primary, #fff)' : 'var(--fg-muted)', font: 'inherit',
        }}>
        {liquid ? 'Liquid: on' : 'Liquid: off'}
      </button>
    </div>
  );
}
