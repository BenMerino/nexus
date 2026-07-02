// AutoHeight — a persistent container that animates its own height to match
// whatever content it holds, so a skeleton→data swap (or any content change)
// reshapes ORGANICALLY instead of snapping. Real layout: the inner content is
// always at its true, natural size; this wrapper just transitions its OWN
// height to that size via a ResizeObserver, so the grid reflows smoothly.
// No fixed heights, no clipping, no fade-over — the container genuinely grows.
import React, { useEffect, useRef, useState } from 'react';

export function AutoHeight({ children, className }: { children: React.ReactNode; className?: string }) {
  const inner = useRef<HTMLDivElement>(null);
  const [h, setH] = useState<number | undefined>(undefined);
  const first = useRef(true);

  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const measure = () => setH(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Skip the transition on the very first sizing (mount) so the initial layout
  // appears instantly; animate every change AFTER that (the data swap).
  useEffect(() => { first.current = false; }, []);

  return (
    <div
      className={className}
      style={{
        height: h,
        transition: first.current ? undefined : 'height 0.45s cubic-bezier(0.2, 0.8, 0.2, 1)',
        overflow: 'clip',   // clip (not hidden) — no scroll, just bounds while resizing
      }}
    >
      <div ref={inner}>{children}</div>
    </div>
  );
}
