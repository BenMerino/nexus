// Platform toggle for the vendored liquid-glass-component-library glass engine
// (see lg-glass.css). Source: github.com/ObaidQatan/liquid-glass-component-library
// @ main (cloned 2026-07-01). Two modes on :root:
//   data-lg        → library GLASS mode (blur + transparency), all browsers.
//   data-lg-liquid → library LIQUID GLASS mode (kube refraction filter), + defaults.
// Default: LIQUID GLASS on (as requested). Persisted in localStorage.
//
// Toggle: window.__lgGlass('liquid'|'glass'|'off'), or window.__lgGlass() to cycle.

import "./lg/kube-filter"; // self-injects the #lg-kube SVG filter

const KEY = "nexus.lg-glass";
type Mode = "off" | "glass" | "liquid";

function apply(mode: Mode): void {
  const root = document.documentElement;
  root.toggleAttribute("data-lg", mode !== "off");
  root.toggleAttribute("data-lg-liquid", mode === "liquid");
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* private mode — non-fatal */
  }
}

// DEFAULT 'liquid' (kube refraction). The filter now applies to a ::before overlay
// inside each surface (lg-glass.css), not the element itself, so it no longer blanks
// page content. Respect a persisted mode; default to liquid when unset.
const saved = (localStorage.getItem(KEY) as Mode | null) ?? "liquid";
apply(saved ?? "liquid");

// Global switch for the dev toggle / console: pass a mode, or cycle off→glass→liquid.
(window as unknown as { __lgGlass: (m?: Mode) => Mode }).__lgGlass = (m?: Mode) => {
  const cur = (localStorage.getItem(KEY) as Mode | null) ?? "liquid";
  const next: Mode = m ?? (cur === "off" ? "glass" : cur === "glass" ? "liquid" : "off");
  apply(next);
  return next;
};

export {};
