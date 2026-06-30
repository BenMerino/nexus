import React, { useState, useEffect } from 'react';

/* LiquidGlass — wraps inline content in liquid-dom's WebGPU glass WHERE SUPPORTED
 * (WebGPU + the HTML-in-Canvas API), else renders the children plainly (our own
 * glass governs via the surrounding surface). The content is portaled through
 * liquid-dom's <Html>, so it stays REAL, functional DOM — refracted, not replaced.
 *
 * Gated + lazy: the 1.2 MB liquid-dom core is only imported on a supporting
 * browser. Used on /dna.html to demo composed components through liquid-dom. */

// The drawElement SYMBOL exists in Chrome even when the HTML-in-Canvas flag is
// OFF — so presence ≠ enabled. Actually INVOKE it on a throwaway canvas; if the
// flag is off it throws (or is a no-op that errors), and we treat it unsupported
// so liquid-dom never loads + shows its "enable the flag" takeover screen.
let _cached: boolean | null = null;
function supported(): boolean {
  if (_cached !== null) return _cached;
  _cached = false;
  if (typeof window === 'undefined' || !('gpu' in navigator)) return false;
  try {
    const ctx = document.createElement('canvas').getContext('2d') as
      (CanvasRenderingContext2D & { drawElement?: (el: Element, x: number, y: number) => void }) | null;
    if (!ctx || typeof ctx.drawElement !== 'function') return false;
    // Probe: a real call. Flag off → throws → caught → unsupported.
    ctx.drawElement(document.createElement('div'), 0, 0);
    _cached = true;
  } catch { _cached = false; }
  return _cached;
}

type LiquidParts = typeof import('@liquid-dom/react');

export function LiquidGlass({ children, cornerRadius = 14 }: {
  children: React.ReactNode; cornerRadius?: number;
}) {
  const [parts, setParts] = useState<LiquidParts | null>(null);
  const ok = supported();

  useEffect(() => {
    if (!ok) return;
    let alive = true;
    import('@liquid-dom/react').then(m => { if (alive) setParts(m); }).catch(() => {});
    return () => { alive = false; };
  }, [ok]);

  // Fallback (unsupported, or core not yet loaded): plain children — our glass
  // surface around them still applies.
  if (!ok || !parts) return <>{children}</>;

  const { LiquidCanvas, GlassContainer, Glass, Html } = parts;
  // Canonical liquid-dom shape (per their README): the scene measures via the
  // host element (ResizeObserver), and Html sizing="intrinsic" hugs the content's
  // natural size — so the glass wraps the real DOM tightly, no fixed Frame needed.
  return (
    <LiquidCanvas style={{ display: 'inline-block' }} frameloop="demand">
      <GlassContainer blur={8} bezelWidth={8} thickness={90} ior={1.46}
        specularStrength={0.5} surfaceProfile="convexCircle" lightDirection={-150}>
        <Glass cornerRadius={cornerRadius} cornerSmoothing={0.6} pointerEvents>
          <Html sizing="intrinsic">{children}</Html>
        </Glass>
      </GlassContainer>
    </LiquidCanvas>
  );
}
