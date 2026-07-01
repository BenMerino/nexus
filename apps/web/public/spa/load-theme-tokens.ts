// Fetch the tenant's configured surface tokens and apply them, caching the
// response for the pre-paint boot script (vite.config.ts THEME_BOOT) so the
// palette applies before first paint next load. Also subscribes to OS
// light/dark changes so the palette swaps live. Lifted verbatim from the old
// shell-mount.tsx (now retired) so the authed React-Router shell keeps the
// exact theme boot behavior (N6).

import { applyThemeMode, activeThemeMode, onSystemThemeChange } from './theme-config';

export function loadThemeTokens(): void {
  fetch('/api/theme-tokens').then(r => (r.ok ? r.json() : null)).then(tokens => {
    if (!tokens) return;
    try { localStorage.setItem('nexus.theme-tokens', JSON.stringify(tokens)); } catch { /* quota / private mode */ }
    const root = document.documentElement;
    for (const k in tokens) root.style.setProperty('--' + k, tokens[k]);
    applyThemeMode(activeThemeMode(), tokens);
    onSystemThemeChange(mode => applyThemeMode(mode, tokens));
    window.dispatchEvent(new CustomEvent('nexus:theme-tokens', { detail: tokens }));
  }).catch(() => {});
}
