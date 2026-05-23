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
