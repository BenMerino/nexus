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
  const animate = useRef(false);

  useEffect(() => {
    const el = inner.current;
    if (!el) return;

    // The content grows in BURSTS as lazy charts mount, so the natural height
    // keeps moving for a moment. Animating to a moving target restarts the
    // transition on every burst → visible stutter. Instead: coalesce the
    // bursts (settle window), then set the height ONCE to the final value and
    // let a single transition glide there. Not a hack — it's the correct way
    // to animate to a size that arrives incrementally: wait for it to stop.
    let settle = 0;
    const commit = () => {
      const next = el.offsetHeight;
      setH((prev) => {
        // First real size: adopt it instantly (no animation) so the initial
        // layout paints at its true height. Later changes animate.
        if (prev === undefined) return next;
        if (next !== prev) animate.current = true;
        return next;
      });
    };
    const ro = new ResizeObserver(() => {
      clearTimeout(settle);
      // 120ms of quiet = the content burst has finished; commit the final size.
      settle = window.setTimeout(commit, 120);
    });
    commit();          // initial size, synchronously, no delay
    ro.observe(el);
    return () => { ro.disconnect(); clearTimeout(settle); };
  }, []);

  return (
    <div
      className={className}
      style={{
        height: h,
        transition: animate.current ? 'height 0.5s cubic-bezier(0.22, 1, 0.36, 1)' : undefined,
        overflow: 'clip',   // bounds the content to the animating height, no scroll
      }}
    >
      <div ref={inner}>{children}</div>
    </div>
  );
}
