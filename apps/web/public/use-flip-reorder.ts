import { useLayoutEffect, useRef } from 'react';

/** FLIP: animate children of `container` when their DOM order changes.
 *  Pass a list of stable keys matching `data-flip-key` on each child.
 *  On every render, measure each child's top against its previous top and
 *  apply an inverted translate; the next frame eases it to zero. */
export function useFlipReorder(
  container: React.RefObject<HTMLElement>,
  keys: string[],
  durationMs = 260,
) {
  const prevTops = useRef<Map<string, number>>(new Map());

  useLayoutEffect(() => {
    const el = container.current;
    if (!el) return;
    const children = Array.from(el.querySelectorAll<HTMLElement>('[data-flip-key]'));
    const nextTops = new Map<string, number>();
    for (const c of children) {
      const k = c.dataset.flipKey!;
      nextTops.set(k, c.offsetTop);
    }
    for (const c of children) {
      const k = c.dataset.flipKey!;
      const prev = prevTops.current.get(k);
      const next = nextTops.get(k)!;
      if (prev === undefined || prev === next) continue;
      const delta = prev - next;
      c.style.transition = 'none';
      c.style.transform = `translateY(${delta}px)`;
      // Force reflow so the browser commits the pre-state.
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      c.offsetHeight;
      c.style.transition = `transform ${durationMs}ms cubic-bezier(0.2, 0, 0, 1)`;
      c.style.transform = '';
    }
    prevTops.current = nextTops;
  }, [container, keys.join('|'), durationMs]);
}
