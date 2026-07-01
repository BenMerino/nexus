// Platform toggle for the vendored liquid-glass-component-library glass engine
// (see lg-glass.css). Source: github.com/ObaidQatan/liquid-glass-component-library
// @ main (cloned 2026-07-01). Two modes on :root:
//   data-lg        → library GLASS mode (blur + transparency), all browsers.
//   data-lg-liquid → library LIQUID GLASS mode (kube refraction filter), + defaults.
// Default: LIQUID GLASS on (as requested). An explicit toggle call persists
// per-origin in localStorage; a plain page load never writes (see below).
//
// Toggle: window.__lgGlass('liquid'|'glass'|'off'), or window.__lgGlass() to cycle.

import "./lg/kube-filter"; // self-injects the #lg-kube SVG filter

const KEY = "nexus.lg-glass";
type Mode = "off" | "glass" | "liquid";

// Sets the DOM attributes only — no storage write. Page load and the explicit
// toggle both funnel through this; only the toggle persists (below).
function applyAttrs(mode: Mode): void {
  const root = document.documentElement;
  root.toggleAttribute("data-lg", mode !== "off");
  root.toggleAttribute("data-lg-liquid", mode === "liquid");
}

// DEFAULT 'liquid' (kube refraction). The filter now applies to a ::before overlay
// inside each surface (lg-glass.css), not the element itself, so it no longer blanks
// page content. Respect a persisted mode; default to liquid when unset.
//
// Every page load used to WRITE the resolved mode back to localStorage — even
// when nothing was explicitly toggled — so this dev-only A/B switch (no UI,
// console-only: window.__lgGlass()) silently diverged between origins/sessions
// the instant anyone called it once anywhere. A page load now only READS;
// only an explicit __lgGlass(mode) call persists.
const saved = (localStorage.getItem(KEY) as Mode | null) ?? "liquid";
applyAttrs(saved);

// Global switch for the dev toggle / console: pass a mode, or cycle off→glass→liquid.
(window as unknown as { __lgGlass: (m?: Mode) => Mode }).__lgGlass = (m?: Mode) => {
  const cur = (localStorage.getItem(KEY) as Mode | null) ?? "liquid";
  const next: Mode = m ?? (cur === "off" ? "glass" : cur === "glass" ? "liquid" : "off");
  applyAttrs(next);
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* private mode — non-fatal */
  }
  return next;
};

export {};
