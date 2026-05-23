// Theme palette configurator (/theme). Superadmin-only editor for the
// core light/dark surface tokens. Edits preview live on the page via
// applyThemeMode; Save persists to /api/theme-tokens (superadmin-gated
// on the server too). The mode toggle here is preview-only — a normal
// user's light/dark mode follows their OS prefers-color-scheme, applied
// by shell-mount.tsx on load.

import React, { useEffect, useMemo, useState } from 'react';
import { useCurrentUser } from '../shell-helpers';
import { TOKENS, DEFAULTS, key, HEX, saveTokens, applyThemeMode, activeThemeMode, type Mode } from './theme-config';

export function ThemeConfigPage() {
  const { me, loading } = useCurrentUser();
  const [mode, setMode] = useState<Mode>(() => activeThemeMode());
  const [values, setValues] = useState<Record<string, string>>(DEFAULTS);
  const [status, setStatus] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/theme-tokens')
      .then(r => (r.ok ? r.json() : {}))
      .then((t: Record<string, string>) => {
        setValues(v => ({ ...v, ...t }));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  // Re-apply the previewed mode whenever values or the selected mode change,
  // so the surrounding chrome reflects edits in real time.
  useEffect(() => {
    if (!loaded) return;
    applyThemeMode(mode, values);
  }, [mode, values, loaded]);

  const isSuper = me?.role === 'superadmin';

  function setToken(token: string, hex: string) {
    setValues(v => ({ ...v, [key(mode, token)]: hex }));
  }

  // Preview-only: pick which mode's palette to edit/preview. Users' actual
  // mode follows their OS setting, so this doesn't persist a choice.
  function selectMode(m: Mode) {
    setMode(m);
  }

  async function save() {
    setStatus('Saving…');
    try {
      const n = await saveTokens(values);
      setStatus(`Saved ${n} token${n === 1 ? '' : 's'}.`);
    } catch (e) {
      setStatus('Error: ' + (e as Error).message);
    }
  }

  const swatch = useMemo(() => ({
    width: 36, height: 28, padding: 0, border: '1px solid var(--border)',
    borderRadius: 4, background: 'none', cursor: 'pointer',
  } as React.CSSProperties), []);

  if (loading) return null;
  if (!isSuper) {
    return (
      <div className="page">
        <h1>Theme palette</h1>
        <div className="status error">Superadmin access required.</div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Theme palette</h1>
      <p style={{ color: 'var(--fg-muted)', marginBottom: 16 }}>
        Core surface colors for each mode. Users see light or dark to match their system setting.
        The toggle below is a preview; Save persists the palette for everyone.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['dark', 'light'] as Mode[]).map(m => (
          <button
            key={m}
            onClick={() => selectMode(m)}
            className="nav-item"
            style={{
              padding: '6px 16px', borderRadius: 6, textTransform: 'capitalize',
              border: '1px solid var(--border)',
              background: mode === m ? 'var(--accent)' : 'var(--bg-card)',
              color: mode === m ? '#1a1612' : 'var(--fg)',
              fontWeight: mode === m ? 600 : 400,
            }}
          >{m}</button>
        ))}
      </div>

      <div className="card" style={{ maxWidth: 460 }}>
        {TOKENS.map(({ token, label }) => {
          const k = key(mode, token);
          const val = values[k] || DEFAULTS[k] || '#000000';
          return (
            <div key={token} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <input
                type="color"
                value={HEX.test(val) ? val : '#000000'}
                onChange={e => setToken(token, e.target.value)}
                style={swatch}
                aria-label={label}
              />
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--fg-muted)' }}>{label}</label>
                <code style={{ fontSize: 12, color: 'var(--fg-dim)' }}>--{token}</code>
              </div>
              <input
                type="text"
                value={val}
                onChange={e => setToken(token, e.target.value)}
                style={{ width: 100, fontFamily: 'var(--mono)', fontSize: 12 }}
              />
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={save}>Save palette</button>
        {status && <span style={{ fontSize: 13, color: 'var(--fg-muted)' }}>{status}</span>}
      </div>
    </div>
  );
}
