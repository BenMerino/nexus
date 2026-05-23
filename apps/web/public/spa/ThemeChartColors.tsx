// Chart heatmap color editor — the "Chart color tokens" config that used
// to live in the admin console (admin-theme-tokens.js). Relocated here so
// all appearance/color config has a single home on /theme. Same four
// gradient stops, same theme_tokens persistence; rebuilt as React to match
// the surface-palette editor above it.

import React, { useEffect, useState } from 'react';
import { HEATMAP, HEATMAP_DEFAULTS, HEX, saveHeatmap } from './theme-config';

function applyVar(token: string, hex: string) {
  document.documentElement.style.setProperty('--' + token, hex);
}

export function ThemeChartColors() {
  const [values, setValues] = useState<Record<string, string>>(HEATMAP_DEFAULTS);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/theme-tokens')
      .then(r => (r.ok ? r.json() : {}))
      .then((t: Record<string, string>) => setValues(v => ({ ...v, ...t })))
      .catch(() => {});
  }, []);

  function set(token: string, hex: string) {
    setValues(v => ({ ...v, [token]: hex }));
    if (HEX.test(hex)) applyVar(token, hex);
  }

  async function save() {
    setStatus('Saving…');
    try {
      await saveHeatmap(values);
      setStatus('Saved.');
      setTimeout(() => setStatus(null), 2000);
    } catch (e) {
      setStatus('Error: ' + (e as Error).message);
    }
  }

  function reset() {
    setValues({ ...HEATMAP_DEFAULTS });
    for (const { token } of HEATMAP) applyVar(token, HEATMAP_DEFAULTS[token]);
    setStatus('Click Save to persist.');
  }

  return (
    <div style={{ marginTop: 32 }}>
      <h2 style={{ fontFamily: 'var(--display)', fontWeight: 400, fontSize: 22, marginBottom: 4 }}>
        Chart colors
      </h2>
      <p style={{ color: 'var(--fg-muted)', marginBottom: 16, fontSize: 13 }}>
        Heatmap gradient for charts. Stops interpolate from <em>From</em> (lowest values) to <em>To</em> (highest).
      </p>

      <div className="card" style={{ maxWidth: 460 }}>
        {HEATMAP.map(({ token, label }) => {
          const val = values[token] || HEATMAP_DEFAULTS[token];
          return (
            <div key={token} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <input
                type="color"
                value={HEX.test(val) ? val : '#000000'}
                onChange={e => set(token, e.target.value)}
                style={{ width: 36, height: 28, padding: 0, border: '1px solid var(--border)', borderRadius: 4, background: 'none', cursor: 'pointer' }}
                aria-label={label}
              />
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--fg-muted)' }}>{label}</label>
                <code style={{ fontSize: 12, color: 'var(--fg-dim)' }}>--{token}</code>
              </div>
              <input
                type="text"
                value={val}
                onChange={e => set(token, e.target.value)}
                style={{ width: 100, fontFamily: 'var(--mono)', fontSize: 12 }}
              />
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={save}>Save chart colors</button>
        <button className="secondary" onClick={reset}>Reset to defaults</button>
        {status && <span style={{ fontSize: 13, color: 'var(--fg-muted)' }}>{status}</span>}
      </div>
    </div>
  );
}
