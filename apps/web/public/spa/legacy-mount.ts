// Bridge for hosting the legacy per-page entry modules (the .tsx root-mounts
// and the .js IIFE modules) inside React Router pages, with TRUE client-side
// nav: React unmounts/remounts the page element on every route change, so each
// legacy module must (re)initialize on every mount — not just its one-time ESM
// top-level run.
//
// Contract: every legacy entry module exports a named `mount()` that is safe to
// call repeatedly (queries the DOM, (re)binds listeners, (re)renders its root).
// ESM caches the module, so the top-level body runs once; the SPA page calls the
// exported `mount()` on every React mount via useLegacyMounts below.

import { useEffect } from 'react';

type MountModule = { mount?: () => void | (() => void) };

/**
 * Run one or more legacy entry modules on every mount of the calling page.
 * Each loader is a dynamic import of a module exporting `mount()`. The page's
 * markup must already be in the DOM (this runs in a layout effect-adjacent
 * useEffect, after React has committed the page body), so id-based queries in
 * the legacy modules resolve.
 *
 * If a module's `mount()` returns a cleanup function, it is invoked on unmount.
 */
export function useLegacyMounts(loaders: Array<() => Promise<MountModule>>): void {
  useEffect(() => {
    let cancelled = false;
    const cleanups: Array<() => void> = [];
    Promise.all(loaders.map(load => load())).then(mods => {
      if (cancelled) return;
      for (const m of mods) {
        const ret = m.mount?.();
        if (typeof ret === 'function') cleanups.push(ret);
      }
    }).catch(() => { /* import/mount failures surface in the page UI */ });
    return () => {
      cancelled = true;
      for (const c of cleanups) { try { c(); } catch { /* best-effort */ } }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
