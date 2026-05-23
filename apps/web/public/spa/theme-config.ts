// Shared model for the theme palette configurator. The configurator edits
// seven core surface tokens for each of two modes (light/dark); each is
// persisted under the key theme-<mode>-<token> via /api/theme-tokens, and
// shell-mount.tsx maps the active mode onto the real --<token> CSS vars.

export type Mode = 'light' | 'dark';

export interface TokenDef { token: string; label: string; }

// Order matches how they cascade visually: surfaces, then border, then text,
// then accent. Keep in sync with SURFACE_TOKENS in shell-mount.tsx.
export const TOKENS: TokenDef[] = [
  { token: 'bg',       label: 'Background' },
  { token: 'bg-elev',  label: 'Elevated surface' },
  { token: 'bg-card',  label: 'Card surface' },
  { token: 'border',   label: 'Border' },
  { token: 'fg',       label: 'Text' },
  { token: 'fg-muted', label: 'Muted text' },
  { token: 'accent',   label: 'Accent' },
];

// Mirrors DEFAULTS in apps/api/handlers/theme-tokens.js. Used as the
// fallback if the API hasn't been populated yet.
export const DEFAULTS: Record<string, string> = {
  'theme-dark-bg': '#1d1f24',
  'theme-dark-bg-elev': '#252830',
  'theme-dark-bg-card': '#2a2d36',
  'theme-dark-border': '#41454f',
  'theme-dark-fg': '#f3f1ec',
  'theme-dark-fg-muted': '#b0ada4',
  'theme-dark-accent': '#e0b341',
  'theme-light-bg': '#f7f6f3',
  'theme-light-bg-elev': '#ffffff',
  'theme-light-bg-card': '#ffffff',
  'theme-light-border': '#d9d6cf',
  'theme-light-fg': '#1d1f24',
  'theme-light-fg-muted': '#5c5f68',
  'theme-light-accent': '#b3801a',
};

export const key = (mode: Mode, token: string) => `theme-${mode}-${token}`;

export const HEX = /^#[0-9a-fA-F]{6}$/;

// Just the token slugs (no labels), in the same order. Used by the runtime
// applier in shell-mount. Kept here, in this side-effect-free module, so
// shell-mount and the configurator can share it without either importing
// the other (importing shell-mount runs its mount() side effect).
export const SURFACE_TOKEN_KEYS = TOKENS.map(t => t.token);

// The active mode mirrors the OS setting (prefers-color-scheme). There is no
// per-user override: the /theme toggle previews a palette but doesn't change
// which mode a normal user sees.
export function activeThemeMode(): Mode {
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

// Re-run cb whenever the OS light/dark setting changes while the app is open.
// Returns an unsubscribe fn. Caller decides what to re-apply.
export function onSystemThemeChange(cb: (mode: Mode) => void): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: light)');
  const handler = (e: MediaQueryListEvent) => cb(e.matches ? 'light' : 'dark');
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}

// Apply one mode's surface palette from a tokens map onto :root, and set
// data-theme so mode-specific CSS can hook in.
export function applyThemeMode(mode: Mode, tokens: Record<string, string>) {
  const root = document.documentElement;
  root.setAttribute('data-theme', mode);
  for (const t of SURFACE_TOKEN_KEYS) {
    const v = tokens[key(mode, t)];
    if (v) root.style.setProperty('--' + t, v);
  }
}

// PUT only the surface keys (the API ignores unknown keys, but sending the
// minimal set keeps the request honest). Returns the count the API reports.
export async function saveTokens(values: Record<string, string>): Promise<number> {
  const body: Record<string, string> = {};
  for (const mode of ['light', 'dark'] as Mode[]) {
    for (const { token } of TOKENS) {
      const k = key(mode, token);
      if (HEX.test(values[k] || '')) body[k] = values[k];
    }
  }
  const resp = await fetch('/api/theme-tokens', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || 'Save failed');
  return data.updated ?? 0;
}

// ── Chart heatmap colors ──────────────────────────────────────────────
// The four heatmap gradient stops, formerly edited in the admin console.
// They live in the same theme_tokens table (keys chart-heatmap-*) and are
// applied app-wide as --chart-heatmap-* CSS vars by shell-mount's
// loadThemeTokens. Edited here so all appearance config has one home.
export const HEATMAP: { token: string; label: string }[] = [
  { token: 'chart-heatmap-from', label: 'From · low' },
  { token: 'chart-heatmap-low',  label: 'Low–mid' },
  { token: 'chart-heatmap-mid',  label: 'Mid–high' },
  { token: 'chart-heatmap-to',   label: 'To · high' },
];

export const HEATMAP_DEFAULTS: Record<string, string> = {
  'chart-heatmap-from': '#3a2a14',
  'chart-heatmap-low':  '#7a5320',
  'chart-heatmap-mid':  '#c08a35',
  'chart-heatmap-to':   '#e8c870',
};

export async function saveHeatmap(values: Record<string, string>): Promise<number> {
  const body: Record<string, string> = {};
  for (const { token } of HEATMAP) {
    if (HEX.test(values[token] || '')) body[token] = values[token];
  }
  const resp = await fetch('/api/theme-tokens', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || 'Save failed');
  return data.updated ?? 0;
}
