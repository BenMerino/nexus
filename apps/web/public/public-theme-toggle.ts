// Manual light/dark override for the public tenant page.
//
// The app normally follows the OS (prefers-color-scheme, see theme-config.ts).
// The public dashboard adds a header button that lets a visitor pin a mode;
// the choice persists in localStorage under PUBLIC_THEME_KEY and the no-FOUC
// boot script (vite.config.ts) reads the same key before first paint, so a
// pinned mode never flashes. Side-effect-free — safe to import anywhere.

import { applyThemeMode, activeThemeMode, type Mode } from './spa/theme-config';

export const PUBLIC_THEME_KEY = 'nexus.public-theme';
const CACHE_KEY = 'nexus.theme-tokens';

// The effective mode: a pinned choice wins over the OS setting.
export function effectiveMode(): Mode {
  try {
    const pinned = localStorage.getItem(PUBLIC_THEME_KEY);
    if (pinned === 'light' || pinned === 'dark') return pinned;
  } catch { /* storage blocked — fall through to OS */ }
  return activeThemeMode();
}

// Read the cached surface-token map shell-mount persisted, so applying a mode
// also restores its customized surfaces (matches the boot script's source).
function cachedTokens(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
  } catch { return {}; }
}

// Apply a mode and persist it as the pinned choice. Re-applies surface tokens
// so the configured palette for that mode lands too.
export function setMode(mode: Mode): void {
  try { localStorage.setItem(PUBLIC_THEME_KEY, mode); } catch { /* ignore */ }
  applyThemeMode(mode, cachedTokens());
}

// Flip to the opposite of whatever is currently on <html>.
export function toggleMode(): Mode {
  const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  const next: Mode = current === 'light' ? 'dark' : 'light';
  setMode(next);
  return next;
}
