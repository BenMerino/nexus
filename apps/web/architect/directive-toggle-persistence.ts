import type { ToggleValues } from './directive-controller-logic.js';

/* ── Toggle persistence ──────────────────────────────────────
 * `useDirectiveController` mirrors toggle selections to localStorage
 * keyed by `directive.persistKey`, so a returning user lands on their
 * last selection without a flash of defaults. SSR/private-browsing
 * safe — both functions no-op when window/storage isn't available.
 * ──────────────────────────────────────────────────────────── */

const STORAGE_PREFIX = 'zincro.directive.toggles.';

export function readPersisted(key: string | undefined): ToggleValues | null {
    if (!key || typeof window === 'undefined') return null;
    try {
        const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
        return raw ? JSON.parse(raw) as ToggleValues : null;
    } catch { return null; }
}

export function writePersisted(key: string | undefined, values: ToggleValues): void {
    if (!key || typeof window === 'undefined') return;
    try { window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(values)); } catch { /* quota / private mode */ }
}
